var mongoose = require("mongoose");

var blogSchema = new mongoose.Schema({
   title: String,
   byline: String,
   image: {type: String, default: "http://source.unsplash.com/cckf4TsHAuw"},
   content: String,
   comments: [
      {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Comment"
      }
   ],
   created: {type: Date, default: Date.now},
   author: {
      id: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "User"
      },
      firstName: String,
      lastName: String
   }
});

module.exports = mongoose.model("Blog", blogSchema);