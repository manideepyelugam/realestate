const mongoose = require("mongoose")


const postSchema = new mongoose.Schema({
    name1:{
        type:String,
    },
     description:{
        type:String
     },
     address:{
        type:String
     },
    imgurl: [],
    imgname: [],
    video:{
        type:String
    },
    mapurl:{
        type :String
    },
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user"
    },


})


module.exports = mongoose.model("post",postSchema)