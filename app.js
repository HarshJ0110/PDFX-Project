// require("dotenv").config();

const express = require('express')
const dotenv = require("dotenv");
const { v4: uuidv4 } = require('uuid');
const bodyparser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session")
const passport = require("passport");
const fs = require("fs")
const path = require('path')
const app = express()
const multer = require('multer')
const mergePdfs = require('./merge')
const ejs = require("ejs");
const docxtopdf = require("docx-pdf");
const passportLocalMongoose = require("passport-local-mongoose");
const nodemailer = require("nodemailer");

dotenv.config({path:"views/.env"});
//The dest property is set to 'uploads/', which means that uploaded files will be stored
// in the uploads directory located in the root directory of the application.

//const upload = multer({ dest: 'uploads/' })

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.use(express.static('public'))
app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());

mongoose.set("strictQuery", true);
mongoose.connect(process.env.MONGODB_URI)

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: String,
  pdfPath: [String],
  resetToken: String,
  resetTokenExpiry: Date
})

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

var upload = multer({ storage: storage })

// Multer is a middleware for handling multipart/form-data, which is primarily used for 
// uploading files in web applications built on Node.js and Express.js.
let name = "";
let logedin = "NO";
let reset = "NO";
let email = "";
let tokens = "";
let length;

app.get('/', (req, res) => {
  res.render("home");
})

app.get('/contact', (req, res) => {
  res.render("contact");
})

app.get('/about', (req, res) => {
  res.render("about");
})

app.get('/signin', (req, res) => {
  res.render("signin");
})

app.get('/login', (req, res) => {
  res.render("login", {port: process.env.PORT});
})

app.get("/Reset-Password", (req, res) => {
  res.render("forget");
})

app.get("/reset/:token", (req, res) => {
  if (reset == "YES") {
    tokens = req.params.token;
    res.render("reset", { resetToken: tokens });
  } else {
    res.redirect("/");
  }
})


app.get("/logout", function (req, res) {
  logedin = "NO"
  req.logout(function (err) {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
})

app.get('/user/:id', (req, res) => {

  const pdfName = req.params.id; // Access the dynamic parameter from the URL

  // Your logic to retrieve user data based on the userId
  // ...
  if (logedin == "YES") {
    res.redirect(`http://localhost:${process.env.PORT}/${pdfName}.pdf`);
  }

})

app.post("/reset/:token", async function (req, res) {

  console.log(tokens);
  try {
    let newPassword = req.body.pass;
    let conPassword = req.body.confpass;
    if (newPassword === conPassword) {
      const user = await User.findOne({ resetToken: tokens, resetTokenExpiry: { $gt: Date.now() } });
      console.log(user);
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      user.setPassword(newPassword, async () => {
        // Clear the reset token fields
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        res.redirect("/login")
        // return res.json({ message: 'Password reset successfully' });
      });
    } else {
      res.send("Both field must conatin same password");
    }
  } catch (error) {
    return res.status(500).json({ error: 'An error occurred while resetting the password' });
  }
})


app.post("/Reset-Password", async function (req, res) {
  reset = "YES"
  let useremail = req.body.email;
  // console.log(useremail);
  let user = await User.findOne({ username: useremail });

  if (!user) {
    res.send("User doesn't exist");
  }
  else {
    email = req.body.email;
    const Token = uuidv4(); // Generate a unique reset token
    const resetTokenExpiry = Date.now() + 3600000; // Token expiration in 1 hour (in milliseconds)

    user.resetToken = Token;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();


    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
    })
    const mailOptions = {
      from: "harshjain0461@gmail.com",
      to: email,
      cc: "harshjain0461@gmail.com",
      subject: 'Password Reset',
      text: `${process.env.TEXT}http://localhost:${process.env.PORT}/reset/${Token}\n\n`
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      }
      else {
        res.redirect('/');
      }
    })

  }
})

app.post("/contact", async function (req, res) {
  try {
    if (name == "") {
      console.log(name);
      res.redirect("/login")
    } else {
      let useremail = name;
      let message = req.body.message;
      // console.log(name + " " + message);
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
      })
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: useremail,
        cc: process.env.EMAIL_USER,
        subject: 'Thanks for giving feedback ' + useremail,
        text: "Thanks for your message You have sent yo us -> " + message,
      };
      await transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        }
        else {
          // console.log("Email sent: " + info.response);

        }
      });
      res.redirect('/');
    }
  } catch {
    res.status(500).json({ error: "Internal server Error" });
  }

})

// login page
app.post("/login", function (req, res) {
  try {
    logedin = "YES";
    name = req.body.username;

    //Creating user for authentication
    const user = new User({
      username: req.body.username,
      password: req.body.password
    })
    req.login(user, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        //Authenticating user
        passport.authenticate("local")(req, res, function () {
          res.redirect("/profile");
        })
      }
    })
  } catch {
    res.status(500).json({ error: "Internal server Error" });
  }

})

app.get("/profile", function (req, res) {
  // Authenticating user
  try {
    if (req.isAuthenticated()) {
      User.findOne({ username: name })
        .then(userFound => {
          res.render("profile", { name: name, pdfPath: userFound.pdfPath });
        })
        .catch(error => {
          console.log(error)
        })

    } else {
      res.redirect("/login");
    }
  } catch {
    res.status(500).json({ error: "Internal server Error" });
  }

})

app.post("/signin", async function (req, res) {
  try {
    logedin = "YES";
    name = req.body.username;
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      return res.status(400).json({ error: "Sorry user with this email already exists" })
    }

    User.register({ username: req.body.username }, req.body.password, function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/signin");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/profile");
        })
      }
    })
  } catch {
    res.status(500).json({ error: "Internal server Error" });
  }

})


let currentDate = new Date();
let day = currentDate.getDate();
let month = currentDate.getMonth() + 1; // Months are zero-based
let year = currentDate.getFullYear();
let date = day + " " + month + " " + year;
//console.log(date);


//The second parameter is the result of calling upload.array('pdfs', 2) which uses a 
//middleware function called upload that is responsible for processing incoming files.
//This middleware function will expect an array of files with the name pdfs and a maximum 
//length of 100. The processed files will be available in the req.files object


app.post('/merge', upload.array('pdfs', 100), async (req, res, next) => {

  try {
    var list = [];
    req.files.forEach(file => {
      let p = path.join(__dirname, file.path);
      list.push(p)
    })

    let g = await mergePdfs(list)

    for (let i = 0; i < list.length; i++) {
      fs.unlinkSync(list[i]);
    }

    let path1 = path.join(__dirname, `public/${g}.pdf`);

    let pdfName = `${g}`;
    //const data = fs.readFileSync(path1);
    console.log(path1);
    if (logedin === "YES") {
      const updatedUser = await User.findOneAndUpdate({ username: name }, { $push: { pdfPath: pdfName } })
      console.log('Updated user:', updatedUser);
      length = updatedUser.pdfPath.length;

      if (length == 9) {
        const deletedPdfName = updatedUser.pdfPath[0];
        const deletedPdfPath = path.join(__dirname, `public/${deletedPdfName}.pdf`);


        User.findOneAndUpdate(
          { username: name },
          { $pull: { pdfPath: deletedPdfName } },
          { new: true } // To get the updated user document
        )
          .then(updatedUser => {
            console.log('Updated user:', updatedUser);
            // Handle the updated user document here
          })
          .catch(error => {
            console.error(error);
            // Handle the error here
          });


        fs.unlink(deletedPdfPath, err => {
          if (err) {
            console.error('Error deleting PDF file:', err);
          } else {
            console.log('PDF file deleted:', deletedPdfPath);
          }
        });
      };
      res.download(path1);
    } else {
      res.download(path1);
    }

    try{
      if (logedin === "YES") {
        setTimeout(() => {
          fs.unlinkSync(__dirname + `/public/${g}.pdf`);
  
          User.findOneAndUpdate(
            { username: name },
            { $pull: { pdfPath: pdfName } },
            { new: true } // To get the updated user document
          )
            .then(updatedUser => {
              console.log('Updated user:', updatedUser);
            })
            .catch(error => {
              console.error(error);
            });
  
        }, process.env.PDF_DELETION_TIME)
      } else {
        setTimeout(() => {
          fs.unlinkSync(__dirname + `/public/${g}.pdf`);
        }, process.env.PDF_DELETE_TIME)
      }
    }catch {
      res.status(500).json({ error: "Internal server Error" });
    }
    
  } catch {
    res.status(500).json({ error: "Internal server Error" });
  }
})

app.post("/doctopdf", upload.single('docx' || 'doc'), async (req, res) => {
  try {
    let outputfile = new Date().getTime() ;
    let outputfilepath = "/public/" + outputfile + ".pdf";
    let deletePdfName1 = "";
    outputfilepath = path.join(__dirname, outputfilepath);

    docxtopdf(req.file.path, outputfilepath, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        res.download(outputfilepath);
      }
    })
    pathOfDocFile = path.join(__dirname, req.file.path);
    // console.log(outputfilepath);
    fs.unlinkSync(pathOfDocFile);

    if (logedin === "YES") {
      const updatedUser1 = await User.findOneAndUpdate({ username: name }, { $push: { pdfPath: outputfile } })
      console.log('Updated user:', updatedUser1);
      length = updatedUser1.pdfPath.length;
      // console.log(length);
      if (length === 9) {
        // console.log("more");
        deletePdfName1 = updatedUser1.pdfPath[0];
        // console.log(deletePdfName1);
        const deletePdfPath1 = path.join(__dirname, `public/${deletePdfName1}.pdf`);
        // console.log(deletePdfPath1);

        User.findOneAndUpdate(
          { username: name },
          { $pull: { pdfPath: deletePdfName1 }},
          { new: true } // To get the updated user document
        )
          .then(updatedUser1 => {
            console.log('Updated user:', updatedUser1);
            // Handle the updated user document here
          })
          .catch(error => {
            console.error(error);
            // Handle the error here
          });


        fs.unlink(deletePdfPath1, err => {
          if (err) {
            console.error('Error deleting PDF file:', err);
          } else {
            console.log('PDF file deleted:', deletePdfName1);
          }
        });
      }; 
    }


    if (logedin === "YES") {
      setTimeout(() => {
        fs.unlinkSync(outputfilepath);

        User.findOneAndUpdate(
          { username: name },
          { $pull: { pdfPath: outputfile } },
          { new: true } 
          // To get the updated user document
        )
          .then(updatedUser1 => {
            console.log('Updated user:', updatedUser1);
          })
          .catch(error => {
            console.error(error);
          });

      }, process.env.PDF_DELETION_TIME)
    } else {
      setTimeout(() => {
        fs.unlinkSync(outputfilepath);
      }, process.env.PDF_DELETE_TIME)
    }
  }
  catch {
    res.status(500).json({ error: "Internal server Error" });
  }
})

app.listen(process.env.PORT, () => {
  console.log("Server is running")
})