var express     = require("express"),
    app         = express(),
    bodyParser  = require("body-parser"),
    mongoose    = require("mongoose"),
    flash       = require("connect-flash"),
    passport    = require("passport"),
    LocalStrategy = require("passport-local"),
    methodOverride = require("method-override"),
    expressSanitizer = require("express-sanitizer"),
    User        = require("./models/user"),
    Blog = require("./models/blog"),
    Comment = require("./models/comment");

app.set("view engine", "ejs");
app.use(express.static(__dirname + "public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressSanitizer());
app.use(methodOverride("_method"));
app.use(flash());
mongoose.connect(process.env.DATABASEURL);


//Passport Configuration
app.use(require("express-session")({
    secret: "Unbelievable",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
   res.locals.currentUser = req.user;
   res.locals.error = req.flash("error");
   res.locals.success = req.flash("success");
   next();
});

// Root Route
app.get("/", function(req,res){
    Blog.find({}, function(err, Blogs){
        if(err || (!Blogs)){
            req.flash("error","Could not find blog post");
            res.redirect("/");
        }
        else{
            res.render("blog/showblogs", {blogList:Blogs});
        }
    });
});


//Authorisation Routes
//Show the register form
app.get("/register", function(req,res){
    res.render("blog/register");
});

//Handle registration request
app.post("/register", function(req, res){
    var newUser = new User({
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.username,
        phone: req.body.phone
      });
    
    if(req.body.adminCode === process.env.ADMINCODE) {
      newUser.isAdmin = true;
    }
    
    User.register(newUser, req.body.password, function(err, user){
        if(err || (!user)){
            req.flash("error",err.message);
            return res.redirect("/register");
        }
        passport.authenticate("local")(req, res, function(){
           req.flash("success", "Successfully registered....\n Welcome "+ user.firstName);
           res.redirect("/"); 
        });
    });
});


//Show the login form
app.get("/login", function(req, res) {
    res.render("blog/login");
});

//Handle login request
app.post("/login", function (req, res, next) {
    User.findOne({username: req.body.username}, function(err, User){
        if(err || (!User)){
            console.log(err);
            req.flash("error","Username is wrong....");
            return res.redirect("/login");
        }else{
            passport.authenticate("local",
            {
                  successRedirect: "/",
                  failureRedirect: "/login",
                  successFlash: "Welcome "+ User.firstName,
                  failureFlash: "Password is wrong...."
                })(req, res);
        }
        });
    });
  

//Handle logout request
app.get("/logout", function(req, res) {
    req.logout();
    req.flash("success","Logged you out....");
    res.redirect("back");
});

//Blog Routes
// show the new post form
app.get("/new", isAdminIn, function(req,res){
    res.render("blog/new");
});

//get the blog post
app.post("/", isAdminIn, function(req,res){
    req.body.blog.author = req.user;
    req.body.blog.content = req.sanitize(req.body.blog.content);
   Blog.create(req.body.blog, function(err, newblog){
       if(err ||(!newblog)){
           req.flash("error","Something went wrong....");
           res.redirect("back");
       }
       else{
           console.log(newblog);
           req.flash("success", "Post submitted....");
           res.redirect("/");
       }
   }); 
});

//Render the show page for each blog
app.get("/:id",function(req, res) {
    Blog.findById(req.params.id).populate("comments").exec(function(err, foundBlog){
        if(err || (!foundBlog)){
            req.flash("error","Something went wrong....");
            res.redirect("back");
        }
        else{
            console.log(foundBlog);
            res.render("blog/show", {blog:foundBlog});
        }
    });
});

//Render the edit page for each blog
app.get("/:id/edit", isAdminIn,  function(req, res) {
    Blog.findById(req.params.id,function(err, foundBlog){
        if(err || (!foundBlog)){
            req.flash("error","Something went wrong....");
            res.redirect("back");
        }else{
            res.render("blog/edit",{blog:foundBlog});
        }
    });
});

//Handle the edit request
app.put("/:id", isAdminIn, function(req,res){
    Blog.findByIdAndUpdate(req.params.id, req.body.blog, function(err, edittedBlog){
        if(err || (!edittedBlog)){
            req.flash("error","Something went wrong....");
            res.redirect("back");
        }else{
            req.flash("success","Blog post editted....");
            res.redirect("/"+req.params.id);
        }
    });
});

//Handle the delete request
app.delete("/:id", isAdminIn, function(req,res){
   Blog.findByIdAndRemove(req.params.id, function(err){
       if(err){
           req.flash("error","Something went wrong....");
           res.redirect("back");
       }else{
           req.flash("success","Blog post deleted....");
           res.redirect("/");
       }
   }); 
});

//Comment Routes
//Handle comment post route
app.post("/:id", isLoggedIn, function(req,res){
    Blog.findById(req.params.id, function(err, foundBlog) {
        if(err || (!foundBlog)){
            req.flash("error","Something went wrong....");
            res.redirect("back");
        }else{
            Comment.create(req.body.comment, function(err, newComment){
                if(err || (!newComment)){
                    req.flash("error","Something went wrong....");
                    res.redirect("back");
                }else{
                    newComment.author.id = req.user._id;
                    newComment.author.firstName = req.user.firstName;
                    newComment.author.lastName = req.user.lastName;
                    newComment.author.isAdmin = req.user.isAdmin;
                    newComment.save();
                   foundBlog.comments.push(newComment);
                    foundBlog.save();
                    req.flash("success"," comment added....");
                    res.redirect("/"+req.params.id);
                }
            });
        }
    });
});

//Edit Comment
//Show the comment edit form
app.get("/:id/:commentid/edit",checkCommentOwnership , function(req, res) {
    Blog.findById(req.params.id, function(err, foundBlog) {
        if(err || (!foundBlog)){
            req.flash("error","Something went wrong....");
            res.redirect("back");
        }else{
            Comment.findById(req.params.commentid, function(err, foundComment) {
                if(err || (!foundComment)){
                    req.flash("error","Something went wrong....");
                    res.redirect("back");
                }else{
                    res.render("blog/editcomment", {comment:foundComment,blog:foundBlog});
                }
            });
        }
    });
});
//Handle edit request
app.put("/:id/:commentid",checkCommentOwnership, function(req,res){
    Blog.findById(req.params.id,function(err, foundBlog) {
        if(err || (!foundBlog)){
            req.flash("error","Something went wrong....");
            res.redirect("back");
        }else{
            Comment.findByIdAndUpdate(req.params.commentid, req.body.comment, function(err, edittedComment){
                if(err || (!edittedComment)){
                    req.flash("error","Something went wrong....");
                    res.redirect("back");
                }else{
                    req.flash("success","Comment editted....");
                    res.redirect("/"+req.params.id);
                }
            });
        }
    });
});

//Delete comment
app.delete("/:id/:commentid", isAdminIn, function(req,res){
    Blog.findById(req.params.id, function(err, foundBlog) {
        if(err || (!foundBlog)){
            req.flash("error","Something went wrong....");
            res.redirect("back");
        }else{
            Comment.findByIdAndRemove(req.params.commentid, function(err){
                if(err){
                    req.flash("error",err.message);
                    res.redirect("back");
                }else{
                    req.flash("success","Comment deleted....");
                    res.redirect("/"+req.params.id);
                }
            });
        }
    });
});

//Middleware
// To check user login
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        req.flash("success","Welcome "+req.user.firstName);
        return next();
    }else{
        req.flash("error","Please login to do that....");
        res.redirect("/login");
    }
    
}

// To check whether Admin is logged in
function isAdminIn(req, res, next){
    if(req.isAuthenticated()){
        if(req.user.isAdmin){
            return next();
        }else{
            req.flash("error", "You are not an admin. Access Denied.");
            res.redirect("back");
        }
    }else{
        req.flash("error","Please login to do that....");
        res.redirect("/login");
    }
}

// To check comment ownership
function checkCommentOwnership(req,res,next){
     if(req.isAuthenticated()){
        Comment.findById(req.params.commentid, function(err, foundComment){
           if((err) || (!foundComment)){
               console.log(err);
               req.flash("error", "Something went wrong....");
                res.redirect("back");

           }  else {
               // does user own the comment?
                if(foundComment.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error","You are not the owner of the comment. So, access denied");
                    res.redirect("back");
                }
           }
        });
    } else {
        req.flash("error","Please login to do that....");
        res.redirect("/login");
    }
}


app.listen(process.env.PORT, process.env.IP, function(){
   console.log("Blog App Started!!");
   
});