var mongoose = require("mongoose");

var commentSchema = new mongoose.Schema({
    text: String,
    author: {
        id: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "User"
      },
      firstName: String,
      lastName: String,
      isAdmin: Boolean
    },
    created: {type: Date, default: Date.now}
});

module.exports = mongoose.model("Comment", commentSchema);