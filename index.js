if(process.env.NODE_ENV != "production"){
  require("dotenv").config();

}
const bodyParser = require('body-parser');

const express = require("express")
const mongoose = require("mongoose")
const app = express()
const postmodel = require("./models/post")
const path = require("path")
const userModel = require("./models/user")
const expressSession = require("express-session")
const passport = require("passport")
const LocalStrategy = require("passport-local")
const session = require("express-session")
const multer  = require('multer');
const flash = require("connect-flash")
const {storage} = require("./cloudconfig")
const upload = multer({storage})
const {cloudinary} = require("./cloudconfig");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const corsConfig = {
  origin : "*",
  credential :true,
  methods: ["GET","POST","PUT","DELETE"]
}
app.options("",cors(corsConfig));
app.use(cors(corsConfig));


app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));


const dburl = process.env.MONGO 

main().then((res) => {console.log("connected")}).catch((err) => {console.log(err)})

async function main(){
    await mongoose.connect(dburl)
}



app.use(express.static("public"));
app.use(express.urlencoded({extended : false}))
app.set("view engine","ejs")
app.set("views",path.join(__dirname,"views"))
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());



const store = MongoStore.create({
  mongoUrl : dburl,
  crypto:{
    secret : process.env.SEC
  },
  touchAfter : 24 * 3600
})


store.on("error",()=>{
  console.log("error in mongo session storage",err)
})

app.use(session({
  store,
  resave:false,
  saveUninitialized:false,
  secret:process.env.SEC,
  cookie:{
    expires : Date.now()+7*24*60*60*1000,
    maxAge : 7 * 24 * 60 * 60 *1000,
    httpOnly : true
   } 
}))









app.use(passport.initialize())
app.use(passport.session())
passport.use(new LocalStrategy(userModel.authenticate()))


passport.serializeUser(userModel.serializeUser())
passport.deserializeUser(userModel.deserializeUser())


const islogged = (req,res,next) => {
  if(!req.isAuthenticated()){
      res.redirect("/login")
      return;
  }
   next() 
}





app.listen(8080,()=>{
  console.log("server online")
})


const errorHandler = (err, req, res, next) => {
console.error(err.stack); 
let statusCode = 500;
if (err.status) {
    statusCode = err.status;
} else if (err.name === 'ValidationError') {
    statusCode = 400; // Bad request for validation errors
}

res.status(statusCode).render('error', { error: err.message });
};



// // register pages
// app.get("/register",(req,res) => {
//     res.render("register.ejs")
// })



// app.post("/reg",(async(req,res,next) => {
//     try{
//         let {username,password,fullname} = req.body
//         const newuser = new userModel({
//             username : username,
//             fullname : fullname
//         })

//         const newRegister = await userModel.register(newuser,password)
//         console.log(newRegister)
//         res.redirect("/login")

//     }catch(e){
//         res.redirect("/register")
//         console.log(e)
//     }
// }))




app.get("/",(req,res,next) => {
  res.redirect("/login")
})

//login
app.get("/login",(req,res,next)=>{
try{
  res.render("login.ejs")

}catch(error){
  next(error)
}
})

app.post("/log",passport.authenticate("local",{failureRedirect:"/login",failureFlash:true}),(async(req,res) => {
  res.redirect("/profile")

}))



//logout
app.get("/logout",(req,res,next) => {
try{
  req.logOut((err) => {
    if(err){
        return next(err)
    }
    res.redirect("/login")
})
}catch(error){
  next(error)
}
  

})





app.get("/profile",islogged,async(req,res,next)=>{
try{
let posts = await userModel.find({username : req.session.passport.user})
let k = await posts[0].populate("posts")
// console.log(k)
  res.render("profile.ejs",{k}); }
  catch(error){
    next(error)
  }
})



app.get("/create",islogged,(req,res,next)=>{
try{
  res.render("create.ejs")
}catch(error){
  next(error)
}
})




app.post('/upload', upload.array('files'),islogged, async (req, res, next) => {
 
try{


  const { name1,description,video,mapurl,address} = req.body;
  const uploadedImages = []; 

  // Handle successful upload
  if (req.files) {
    for (const file of req.files) {
      uploadedImages.push({
        imgurl: file.path,
        imgname: file.filename,
      });
    
    }

    try {
      const newPost = await postmodel.create({
        name1,
        description,
        address,
        video,
        mapurl,
        imgurl: uploadedImages.map(image => image.imgurl),
        imgname: uploadedImages.map(image => image.imgname),
      });
      // console.log(newPost);
      // res.send('Files uploaded successfully!');


      let userId = req.session.passport.user
      const userr = await userModel.find({username : userId})
       const use = userr[0]


       if (!use) {
        return res.status(404).send('User not found!');
      }

      use.posts.push(newPost._id);
      await use.save();
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).send('Error uploading files!');
    }
  } else {
    res.status(400).send('No files uploaded!');
  }

  res.redirect("/profile")}
  catch(error){
    next(error)
  }
});







app.post("/delete/:id",async(req,res,next)=>{
try{


let {id} = req.params;
const username = req.session.passport.user; // Assuming 'user' is the key in the session object
const query = { username };
try{
// Remove the element using $pull operator
const updatedUser = await userModel.findOneAndUpdate(
  query,
  { $pull: { posts: id } },
  { new: true } // Return the updated user document
);

if (!updatedUser) {
  throw new Error("User not found or element not present in posts array");
}

// res.json({ message: "Post removed successfully!" }); // Assuming success response
}

// Error handling (optional)
catch (error) {
  console.error("Error removing post:", error);
  res.status(500).send("Error removing post!");
}


try {
  const image = await postmodel.findById(id);
  const name = image.imgname

  if (!image) {
    return res.status(404).send("Image not found!");
  }

  // Handle multiple or zero images gracefully
  for (const publicId of name) {
    await cloudinary.uploader.destroy(publicId)
      .catch(error => console.error("Error deleting individual image:", error)); // Handle individual errors
  }

  // Delete image document from MongoDB
  await image.deleteOne();
 

  // res.json({ message: "Image(s) deleted successfully!" }); // Account for potentially multiple images
} catch (error) {
  console.error("Error deleting image(s):", error);
  res.status(500).send("Error deleting image(s)!");
}


res.redirect("/profile")}
catch(error){next(error)}
})




app.get("/see/:id",async(req,res,next)=>{
try{
     let {id} = req.params
     const member = await postmodel.findById(id)
     res.render("show.ejs",{member})}
     catch(error){
      next(error)
     }
})





app.use(errorHandler); // Place this at the bottom of your app.js file, after all other routes



