const RoleDefinition =
require("../models/RoleDefinition");

async function seedRoles(){

    const roles = [

        {code:"ARRIVAL_DISPATCH",name:"Arrival Dispatcher"},

        {
            code:"DISPATCH",
            name:"Departure Dispatcher"
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
            name:"Arrival Agent"
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

        if (existing && ((role.code === 'DISPATCH' && existing.name === 'Dispatcher') ||
            (role.code === 'ARRIVAL' && existing.name === 'Arrival'))) {
            await RoleDefinition.updateOne({_id:existing._id,name:existing.name},{$set:{name:role.name}});
        }

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