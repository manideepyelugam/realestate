const mongoose = require("mongoose")
const localMongoose = require("passport-local-mongoose")


const userSchema = new mongoose.Schema({
    posts:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'post'
    }],
    fullname:{
        type:String,
        required:true
    },
    username:{
        type:String
    },
    password:{
        type:String
    }

})
userSchema.plugin(localMongoose)

module.exports = mongoose.model("user",userSchema)