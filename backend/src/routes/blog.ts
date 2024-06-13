import { Hono } from "hono";
import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'
import {  verify } from 'hono/jwt'
import { createBlog, updateBlog } from "@tanyashukla/blog-common";



export const blogRouter = new Hono<{
	Bindings: {
		DATABASE_URL: string,
    JWT_SECRET:string,
    
	},
  Variables:{
    userId:string,
    userName:string,
    ids:string
}
}>();



 blogRouter.use('/*', async (c, next) => {
  const authHeader = c.req.header("authorization") || "";
  
  try {
      const user = await verify(authHeader, c.env.JWT_SECRET);
      if (user ) {
          c.set("userId", user.id );
          c.set("userName",user.name)
          await next();
      } else {
          c.status(403);
          return c.json({
              message: "You are not logged in"
          })
      }
  } catch(e) {
      c.status(403);
      return c.json({
          message: "You are not logged in"
      })
  }
})
  
  blogRouter.post('/', async (c) => {
    
    
    const body = await c.req.json();
    const {success}=createBlog.safeParse(body);
  if(!success)
  {
    c.status(403);
    return c.json({
        message:"Invalid Inputs"
    })
  }
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
}).$extends(withAccelerate())
    const response=await prisma.post.create({
        data:{
            title:body.title,
            content:body.content,
            authorId:c.get("userId"),
            
        }
    })
    return c.json({
        id:response.id
    })
  })
  
  
            
            
  blogRouter.put('/:id', async (c) => {
    try {
        const prisma = new PrismaClient({
            datasourceUrl: c.env.DATABASE_URL,
        }).$extends(withAccelerate());

        const id = c.req.param("id");
        const body = await c.req.json();

        // Fetch the author ID based on the provided author name, or set it to null if anonymous
        let authorId = "";
        if (body.author && body.author !== "Anonymous") {
            const author = await prisma.user.findFirst({
                where: {
                    name: body.author,
                },
            });
            if (author) {
                authorId = author.id;
            }
        }

        const response = await prisma.post.update({
            where: {
                id: id,
            },
            data: {
                title: body.title,
                content: body.content,
                published: body.published,
                anonymous:body.anonymous
                 // Use the author ID if found, or null if anonymous
            },
        });

        return c.json({
            response,
        });
    } catch (e) {
        console.error(e);
        c.status(500);
        return c.json({
            error: "Internal Server Error",
        });
    }
});

blogRouter.get('/drafts', async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate())
    
    

    try {
        const blogs = await prisma.post.findMany({
            where:{
                authorId:c.get("userId"),
                published:false
            },
            select: {
                content: true,
                title: true,
                id: true,
                published:true,
                publishedDate: true,
                anonymous: true,
                author: {
                    select: {
                        name: true
                    }
                }
            }
        });

        console.log("Fetched blogs for /drafts:", blogs);

        if (blogs.length === 0) {
            console.log("No drafts found");
            return c.json({ message: "No drafts found" });
        }

        return c.json({ blogs });
    } catch (error) {
        console.error("Error fetching blogs for /drafts:", error);
        return c.json({ error: "An error occurred while fetching drafts" }, 500);
    }
  })
  blogRouter.get('/bulk', async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate())
    
    

    const blogs=await prisma.post.findMany({
        where:{
            published:true
        },
      select:{
        content:true,
        title:true,
        id:true,
        publishedDate:true,
        anonymous:true,
        author:{
          select:{
            name:true
          }
        }
      }
    });
      
    

    return c.json({
      blogs
    })
  })

  blogRouter.get('/:id', async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate())
    
    
    const id =  c.req.param("id");
    const response=await prisma.post.findMany({
        where:{
            id:id
        },
        select:{
         
          content:true,
          title:true,
          id:true,
          publishedDate:true,
          anonymous:true,
          author:{
            select:{
              id:true,
              name:true,
              about:true
            }
          }
        }
    });

    return c.json({
      response
    })
  })


  
  blogRouter.post('/save', async (c) => {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate())

  const body = await c.req.json();
  const userId=c.get("userId")

  try {
      const user = await prisma.user.findUnique({
          where: { id: userId }
      });

      if (!user) {
           c.status(404)
          return c.json({ error: 'User not found' });
      }
      
      if (!user.saved.includes(body.id)) {
       // const updatedSaved = [...user.saved, id];
          await prisma.user.update({
              where: { id: userId },
              data: {
                  saved: {
                      push: body.id
                  }
              }
          });
      }

       c.status(200)
      return c.json({ message: 'Post saved successfully' });
  } catch (error) {
      console.error('Error saving post:', error);
     c.status(500)
      return c.json({ error: 'Internal Server Error' });
  }
});


blogRouter.post('/unsave', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
}).$extends(withAccelerate())

const body = await c.req.json();
const userId=c.get("userId")

  try {
      const user = await prisma.user.findUnique({
          where: { id: userId }
      });

      if (!user) {
           c.status(404)
          return c.json({ error: 'User not found' });
      }

      if (user.saved.includes(body.id)) {
          await prisma.user.update({
              where: { id: userId },
              data: {
                  saved: {
                      set: user.saved.filter(id => id !== body.id)
                  }
              }
          });
      }

       c.status(200)
      return c.json({ message: 'Post unsaved successfully' });
  } catch (error) {
      console.error('Error unsaving post:', error);
       c.status(500)
      return c.json({ error: 'Internal Server Error' });
  }
});


blogRouter.post('/unsave', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
}).$extends(withAccelerate())

const body = await c.req.json();
const userId=c.get("userId")

  try {
      const user = await prisma.user.findUnique({
          where: { id: userId }
      });

      if (!user) {
           c.status(404)
           return c.json({ error: 'User not found' });
      }

      if (user.saved.includes(body.id)) {
          await prisma.user.update({
              where: { id: userId },
              data: {
                  saved: {
                      set: user.saved.filter(id => id !== body.id)
                  }
              }
          });
      }

       c.status(200)
       return c.json({ message: 'Post unsaved successfully' });
  } catch (error) {
      console.error('Error unsaving post:', error);
       c.status(500)
       return c.json({ error: 'Internal Server Error' });
  }
});

blogRouter.post('/saved', async (c) => {
    const prisma = new PrismaClient({
        datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate())
    
    const body= await c.req.json()
    const response=await prisma.post.findMany({
        where:{
            id:{
               in:body.saved
        }
    },
        select:{
            content: true,
            title: true,
            id: true,
            publishedDate: true,
            anonymous: true,
            author: {
                select: {
                    id: true,
                    name: true,
                },
            },
        }
    })
    return c.json({ response });
  });

 