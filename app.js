const express = require("express");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const methodOverride = require("method-override");
const bodyParser = require("body-parser");
const ObjectID = require("mongodb").ObjectId;

const app = express();
//Middleware
app.use(bodyParser.json());
//this tells us that we are going to create a query string
app.use(methodOverride("_method"));
app.set("view engine", "ejs");

//mongo uri
const mongoURI =
  "mongodb+srv://root:root@cluster0.yizcs.mongodb.net/fileUploads";
//create connection
const conn = mongoose.createConnection(mongoURI);
//init gfs
let gfs, gridfsBucket;
conn.once("open", () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

//create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileInfo);
      });
    });
  },
});
const upload = multer({ storage });

//@Route GET /
//@desc loads form
app.get("/", (req, res) => {
  // res.render("index");
  gfs.files.find().toArray((err, files) => {
    //checking for files exist or not
    if (!files || files.length === 0) {
      res.render("index", { files: false });
    } else {
      files.map((file) => {
        if (
          file.contentType === "image/jepg" ||
          file.contentType === "image/jpg" ||
          file.contentType === "image/png"
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.render("index", { files: files });
    }
    //files exist
    // return res.json(files);
  });
});

//@Route POST /upload
//@desc uploads file to db
app.post("/upload", upload.single("file"), (req, res) => {
  // res.json({ file: req.file });
  res.redirect("/");
});

//@route GET /files
//@desc Display all fiels in JSON
app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    //checking for files exist or not
    if (!files || files.length === 0) {
      return res.status(404).json({
        err,
        msg: "No files exist",
      });
    }
    //files exist
    return res.json(files);
  });
});

//@route GET /files/:filename
//@desc Display distinct file in JSON
app.get("/files/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file) {
      return res.status(404).json({
        err,
        msg: "No file exist",
      });
    }
    //files exist
    return res.json(file);
  });
});

//@route GET /image/:filename
//@desc Display distinct file in JSON
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file) {
      return res.status(404).json({
        err,
        msg: "No file exist",
      });
    }
    // console.log("File exist");
    //files exist
    // return res.json(file);
    //check if image
    if (
      file.contentType === "image/jepg" ||
      file.contentType === "image/jpg" ||
      file.contentType === "image/png"
    ) {
      // Read output stream
      const readStream = gridfsBucket.openDownloadStream(file._id);
      readStream.pipe(res);
    } else {
      res.status(404).json({ msg: "This is not image file" });
    }
  });
});

// @route DELETE /files/:id
// @desc Delete file
app.delete("/files/:id", async (req, res) => {
  await gridfsBucket
    .delete(ObjectID(req.params.id))
    .then(() => res.redirect("/"))
    .catch((e) => console.log(e));
});

// @route DOWNLOAD /files/:id
// @desc download file
app.get("/download/:id", async (req, res) => {
  gfs
    .collection("uploads")
    .findOne({ _id: ObjectID(req.params.id) }, (err, file) => {
      if (err) {
        // report the error
        console.log(err);
      } else {
        // detect the content type and set the appropriate response headers.
        let mimeType = file.contentType;
        if (!mimeType) {
          mimeType = mime.lookup(file.filename);
        }
        res.set({
          "Content-Type": mimeType,
          "Content-Disposition": "attachment; filename=" + file.filename,
        });
        const readStream = gridfsBucket.openDownloadStream(file._id);
        readStream.pipe(res);
      }
    });
});

const port = 5000;
app.listen(port, () => {
  console.log(`Listen on ${port}`);
});
