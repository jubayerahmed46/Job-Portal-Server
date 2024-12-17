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
  "use strict";
  try {
    await client.connect();
    const database = client.db("Job-PortalDB");
    const jobsCollection = await database.collection("jobs");
    const applicationsCollection = await database.collection("applications");

    // get all running jobs || get reqruter data using query param
    app.get("/jobs", async (req, res) => {
      try {
        let query = {};
        let default_limit = 8;

        if (req.query.email) {
          query = { hr_email: req.query.email };
        }

        const jobs = await jobsCollection
          .find(query)
          .limit(default_limit)
          .toArray();

        if (!jobs.length) {
          res.send("Data not found!");
        }
        res.send(jobs);
      } catch (error) {
        res.send(`server error : ${error}`);
      }
    });

    // See every job details
    app.get("/jobs/details/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await jobsCollection.findOne(query);

        res.send(result);
      } catch (error) {
        res.send(`server error : ${error}`);
      }
    });

    // get a specific job application || only for a reqruter
    app.get("/job/view-applications/:job_id", async (req, res) => {
      try {
        const id = req.params.job_id;
        const query = { job_id: id };

        const result = await applicationsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.send(`server error : ${error}`);
      }
    });

    // update  job seeker applications and make a status
    app.patch("/job/applicatons/application/:id", async (req, res) => {
      try {
        const body = req.body;
        console.log("triggered");
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const option = {
          $upser: true,
        };
        const updateDoc = {
          $set: {
            status: body.status,
          },
        };

        const result = await applicationsCollection.updateOne(
          filter,
          updateDoc,
          option
        );

        res.send(result);
      } catch (error) {
        res.send(`server error : ${error}`);
      }
    });

    // apply on a job as a job seeker
    app.post("/applications", async (req, res) => {
      try {
        const doc = req.body;

        const applyJob = await applicationsCollection.insertOne(doc);

        const id = doc.job_id;
        const query = { _id: new ObjectId(id) };
        const result = await jobsCollection.findOne(query);
        let countApplication = 0;

        if (result.countApplication) {
          countApplication = result.countApplication + 1;
        } else {
          countApplication = 1;
        }

        // now update the job info
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            applicationCount: countApplication,
          },
        };

        await jobsCollection.updateOne(filter, updateDoc);

        res.send(applyJob);
      } catch (error) {
        res.send(`server error : ${error}`);
      }
    });

    // post a new job as a reqruter
    app.post("/jobs", async (req, res) => {
      try {
        const doc = req.body;
        const result = await jobsCollection.insertOne(doc);
        res.send(result);
      } catch (error) {
        res.send(`server error: ${error}`);
      }
    });

    // load all application of current user/reqruter
    app.get("/my-applications", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email };
        const applications = await applicationsCollection.find(query).toArray();

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

    // delete reqruter data from privet route
    app.delete("/my-applications/:id", async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const result = await applicationsCollection.deleteOne(filter);

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
