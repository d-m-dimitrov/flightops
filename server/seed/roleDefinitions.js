const RoleDefinition =
require("../models/RoleDefinition");

async function seedRoles(){

    const roles = [

        {
            code:"DISPATCH",
            name:"Dispatcher"
        },

        {
            code:"CHECKIN",
            name:"Check-In"
        },

        {
            code:"GATE",
            name:"Gate"
        },

        {
            code:"ARRIVAL",
            name:"Arrival"
        },

        {
            code:"RAMP",
            name:"Ramp"
        },

        {
            code:"SPUR",
            name:"SPUR"
        }

    ];

    for(const role of roles){

        const existing =
        await RoleDefinition.findOne({
            code:role.code
        });

        if(!existing){

            await RoleDefinition.create(
                role
            );

            console.log(
                `Created role ${role.code}`
            );

        }

    }

}

module.exports =
seedRoles;