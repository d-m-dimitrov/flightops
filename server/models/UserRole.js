const mongoose =
require("mongoose");

const UserRoleSchema =
new mongoose.Schema({

    userId:{

        type:
        mongoose.Schema.Types.ObjectId,

        ref:"User",

        required:true

    },

    role:{

        type:String,

        required:true

    }

});

module.exports =
mongoose.model(
    "UserRole",
    UserRoleSchema
);