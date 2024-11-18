const express=require('express')
const app=express()
const mongoose=require('mongoose')
const userModel=require("./models/user");
const postModel=require("./models/post");
const cookieParser = require('cookie-parser')
const bcrypt=require('bcrypt')
const jwt=require('jsonwebtoken')
const path=require("path")
const upload=require("./config/multerconfig")
app.set("view engine","ejs")
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())
app.use(express.static(path.join(__dirname,"public")))



app.get('/',(req,res)=>{
    res.render("main")
})
app.get("/register",(rq,res)=>{
    res.render("index")
})
app.post("/register",async (req,res)=>{
    let {username,name,age,email,password}=req.body;
   let user= await userModel.findOne({email})
   if(user){
    return res.status(500).send("user already registered");
   }
   bcrypt.genSalt(10,(err,salt)=>{
    bcrypt.hash(password,salt,async (err,hash)=>{
        let user=await userModel.create({
            username,
            email,
            age,
            name,
            password:hash,
            posts:[
               
            ]
        });
        let token=jwt.sign({email:email,userid:user._id},"secret");
        res.cookie("token",token)
        res.redirect("/profile")
    })
   })
})

app.get('/login',(req,res)=>{
    res.render("login")
})
app.post("/loginform",async (req,res)=>{
    let user =await userModel.findOne({email:req.body.email})
   if(!user)
     return res.send("something went wrong")
 
     bcrypt.compare(req.body.password,user.password,(err,result)=>{
        if(result){
         let token=jwt.sign({email:user.email,userid:user._id},"secret")
         res.cookie("token",token)
          res.redirect("/profile")
        }else{
         res.redirect('/')
        }
     })
 })
 
 app.get('/profile', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email }).populate("posts");
        if (!user) {
            return res.status(404).send("User not found");
        }
        res.render("profile", { user });
    } catch (err) {
        console.error("Error fetching user profile:", err.message); 
        res.status(500).send("Internal Server Error");
    }
});


app.get('/logout',(req,res)=>{
    res.cookie("token","");
    res.render("login")
})

app.post("/create-post",isLoggedIn,async(req,res)=>{
    let user=await userModel.findOne({email:req.user.email})
    let {content}=req.body
    let post=await postModel.create({
        user:user._id,
        content:content
    })
    user.posts.push(post._id)
    await user.save()
    res.redirect("/profile")
})

app.get("/like/:id",isLoggedIn,async(req,res)=>{
    let post=await postModel.findOne({_id:req.params.id}).populate("user")
    if(post.likes.indexOf(req.user.userid)===-1){
        post.likes.push(req.user.userid)
    }else{
        let index=post.likes.indexOf(req.user.userid)
        post.likes.splice(index,1)
    }
     
    await post.save();
    res.redirect("/profile");
})

app.get("/edit/:id",isLoggedIn,async(req,res)=>{
    let post=await postModel.findOne({_id:req.params.id}).populate("user")
    let user=req.user
    let details=await userModel.findOne({_id:user.userid})
    console.log(user)
    res.render("edit",{user,post,details})
   
})


app.post("/updatepost/:id", isLoggedIn, async (req, res) => {

    let post = await postModel.findOneAndUpdate(
        { _id: req.params.id },
        {
            $set: {
                content: req.body.content,
                date: new Date()
            }
        }
    );

    res.redirect("/profile");
});


app.post("/delete/:id", isLoggedIn, async (req, res) => {

    let post = await postModel.findOneAndDelete(
        { _id: req.params.id }
    );

    res.redirect("/profile");
});

// app.get('/test',(req,res)=>{
//     res.render("test")
// })

app.post('/upload',isLoggedIn,upload.single("image"),async (req,res)=>{
   
   let user=await  userModel.findOne({email:req.user.email})
   user.profilepic=req.file.filename;
   await user.save();
   res.redirect("/profile")
})


app.get("/profile/upload",(req,res)=>{
    res.render("profileupload")
})


function isLoggedIn(req, res, next) {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.redirect("/login");
        }

        const data = jwt.verify(token, "secret"); 
        req.user = data; 
        next();
    } catch (err) {
        console.error("JWT verification failed:", err.message); // Log errors for debugging
        res.redirect("/login"); // Redirect if there's an issue
    }
}

app.listen(3000)