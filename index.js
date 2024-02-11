const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 4321;
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);


// middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());

const verifyToken = (req, res, next) => {
    // console.log("inside middleware", req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: "Access forbidden" })
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(401).send({ message: "Access forbidden" })
        }
        req.decoded = decoded;
        next();
    })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jrqljyn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const divisionCollection = client.db("travel-beyond").collection("division");
        const userCollection = client.db("travel-beyond").collection("user");
        const tourCollection = client.db("travel-beyond").collection("tour");
        const bookingCollection = client.db("travel-beyond").collection("bookings");
        const reviewCollection = client.db("travel-beyond").collection("review");
        const guideCollection = client.db("travel-beyond").collection("guide");


        // middleware again

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'Access forbidden' })
            }
            next();
        }

        // jwt api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = await jwt.sign(user, process.env.SECRET_TOKEN, { expiresIn: '1h' });
            res.send({ token });
        })

        // user api
        app.post("/user", async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        })
        app.get("/user", verifyToken, verifyAdmin, async (req, res) => {
            // console.log(req.headers);
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get("/user/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "Access Unauthorized" })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.patch('/user/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // division api
        app.get("/division", async (req, res) => {
            const result = await divisionCollection.find().toArray();
            res.send(result);
        })

        // tour api
        app.get("/tour", async (req, res) => {
            const result = await tourCollection.find().toArray();
            res.send(result);
        })

        app.post("/tour", async (req, res) => {
            const tour = req.body;
            const result = await tourCollection.insertOne(tour);
            res.send(result);
        })
        app.delete("/tour/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await tourCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/tour/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    title: item.title,
                    division: item.division,
                    price: parseFloat(item.price),
                    deadline: item.deadline,
                    places: item.places,
                    transportation: item.transportation,
                    included_item: item.included_item,
                    description: item.description,
                    image: item.image
                }
            }

            const result = await tourCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //   bookings api
        app.post('/bookings', async (req, res) => {
            const bookingItem = req.body;
            const result = await bookingCollection.insertOne(bookingItem);
            res.send(result);
        })
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const admin = req.query.admin;
            let query = {};

            if (email) {
                query.email = email;
            } else if (admin) {
                query.admin = admin;
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })
        app.delete("/bookings/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })
        app.delete("/bookings/admin/:id", async (req, res) => {
            const id = req.params.id;
            const query = { eventId: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })

        // app.post('/create-payment-intent', async (req, res) => {
        //     const { price } = req.body;
        //     const amount = parseInt(price * 100);
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: amount,
        //         currency: "usd",
        //         payment_method_types: ["card"]
        //     });
        //     res.send({
        //         clientSecret: paymentIntent.client_secret
        //     });
        // })

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')
      
            const paymentIntent = await stripe.paymentIntents.create({
              amount: amount,
              currency: 'usd',
              payment_method_types: ['card']
            });
      
            res.send({
              clientSecret: paymentIntent.client_secret
            })
          });

        // review api
        app.post('/review', async (req, res) => {
            const { email, review, userName } = req.body;
            if (!email || !review) {
                return res.status(400).json({ error: 'Email and review are required fields' });
            }
            const reviewItem = { email, review, userName };
            const result = await reviewCollection.insertOne(reviewItem);
            res.send(result);
        })

        app.get('/review', async (req, res) => {
            const email = req.query.email;
            let query = {};
            if (email) {
                query.email = email;
            }
            const result = await reviewCollection.find(query).toArray();
            res.send(result);
        })


        app.get("/guide", async (req, res) => {
            const result = await guideCollection.find().toArray();
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send("travel beyond is traveling")
})

app.listen(port, () => {
    console.log(`travel beyond is traveling through port ${port}`);
})