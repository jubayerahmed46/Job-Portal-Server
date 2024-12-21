const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT;
// middlewares
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-d5361.web.app/",
      "https://job-portal-d5361.firebaseapp.com/",
    ],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// verify token middleware
const varifyToken = (req, res, next) => {
  if (!req.query.email) {
    next();
    return;
  }
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized Error" });
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Error" });
    }

    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0shnp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri);

(async function () {
  "use strict";
  try {
    await client.connect();
    const database = client.db("Job-PortalDB");
    const jobsCollection = await database.collection("jobs");
    const applicationsCollection = await database.collection("applications");

    // create jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_KEY);

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "Strict",
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 0,
        })
        .send({ message: "Logget out" });
    });

    // get all running jobs || get reqruter data using query param
    app.get("/jobs", varifyToken, async (req, res) => {
      try {
        let query = {};
        let default_limit = 8;

        if (req.query.email) {
          query = { hr_email: req.query.email };

          if (req.user.email !== req.query.email) {
            return res.status(403).send({ message: "Forbidden" });
          }
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
        res.status(500).send({ message: "Internal server error" });
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
        res.status(500).send({ message: "Internal server error" });
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
        res.status(500).send({ message: "Internal server error" });
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
        res.status(500).send({ message: "Internal server error" });
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
        res.status(500).send({ message: "Internal server error" });
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
    app.get("/my-applications", varifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (req.user.email !== email) {
          return res.status(403).send({ message: "Forbidden" });
        }
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
