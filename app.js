const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT;
// middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0shnp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);

(async function () {
  try {
    await client.connect();
    const database = client.db("Job-PortalDB");
    const jobsCollection = await database.collection("jobs");
    const applicationsColletion = await database.collection("applications");

    app.get("/jobs", async (_, res) => {
      try {
        const result = await jobsCollection.find().toArray();

        if (!result.length) {
          res.send("Data not found!");
        }
        res.send(result);
      } catch (error) {
        res.send("server error", error);
      }
    });

    app.get("/jobs/details/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await jobsCollection.findOne(query);

        res.send(result);
      } catch (error) {
        res.send("server error", error);
      }
    });

    app.post("/applications", async (req, res) => {
      try {
        const doc = req.body;
        console.log(doc);

        const result = await applicationsColletion.insertOne(doc);

        res.send(result);
      } catch (error) {
        res.send("server error", error);
      }
    });

    app.get("/my-applications", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email };
        const applications = await applicationsColletion.find(query).toArray();

        for (const application of applications) {
          const jobQuery = { _id: new ObjectId(application.job_id) };
          const jobCard = await jobsCollection.findOne(jobQuery);

          application.title = jobCard.title;
          application.location = jobCard.location;
          application.salaryRange = jobCard.salaryRange;
          application.requirements = jobCard.requirements;
          application.company_logo = jobCard.company_logo;
          application.company = jobCard.company;
        }

        res.send(applications);
      } catch (error) {
        res.send(`server error: ${error}`);
      }
    });

    app.delete("/my-applications/:id", async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const result = await applicationsColletion.deleteOne(filter);

        res.send(result);
      } catch (error) {
        res.send(`server error: ${error}`);
      }
    });

    // running mongo Function end
  } catch (error) {
    console.dir(error);
  }
})();

app.get("/", (_, res) => {
  res.send("the server in running......");
});

app.listen(port, () => {
  console.log(`server running port on: ${port}`);
});
