function checkAuth(){

    const token =
    localStorage.getItem(
        "token"
    );

    if(!token){

        window.location =
        "login.html";

        return false;
    }

    return true;
}

function logout(){

    localStorage.clear();

    window.location =
    "login.html";

}


function getCurrentUser(){

    return JSON.parse(

        localStorage.getItem(
            "user"
        )

    );

}


function applyRolePermissions(){

    const user =
    getCurrentUser();

    if(!user){
        return;
    }

    if(user.role !== "ADMIN"){

        document
        .querySelector(
            'a[href="staff.html"]'
        )
        ?.remove();

    }

}

function canEdit(module){

    const user =
    getCurrentUser();

    if(!user){
        return false;
    }

    const skills =
    user.skills || [];

    const position =
    user.position || "";

    const permissions = {

        PASSENGERS:[
            "CHECKIN",
            "GATE",
            "ARRIVAL"
        ],

        SPECIAL_HANDLING:[
            "CHECKIN",
            "GATE",
            "ARRIVAL"
        ],

        FLIGHT_DETAILS:[
            "DISPATCH"
        ],

        ASSIGNMENTS:[]
    };
if(
    [
        "OPERATIONS_DM",
        "PAX_DM",
        "RAMP_DM",
        "SPUR_DM"
    ].includes(position)
){
    return true;
}

    if(module === "ASSIGNMENTS"){

        return [

            "TRAFFIC_COORDINATOR",
            "CHECKIN_SUPERVISOR",
            "RAMP_ALLOCATOR",
            "SPUR_COORDINATOR"

        ].includes(
            position
        );

    }

    return permissions[module]
    ?.some(

        skill =>

        skills.includes(
            skill
        )

    );

}




function showCurrentUser(){

    const user =
    JSON.parse(
        localStorage.getItem(
            "user"
        )
    );

    if(!user){
        return;
    }

    const panel =
    document.getElementById(
        "currentUserInfo"
    );

    if(!panel){
        return;
    }

panel.innerHTML = `

    👤 ${user.name}

    <span
        class="badge ms-2 bg-primary">

        ${user.position || "-"}

    </span>

`;
}

function applyMenuPermissions(){

    const user =
    getCurrentUser();

    if(!user){
        return;
    }

    const canManage =

        user.role === "ADMIN"
        ||

        [
            "OPERATIONS_DM",
            "PAX_DM",
            "RAMP_DM",
            "SPUR_DM"
        ].includes(
            user.position
        );

    const schedulesMenu =
    document.getElementById(
        "menuSchedules"
    );

    const staffMenu =
    document.getElementById(
        "menuStaff"
    );

    if(
        schedulesMenu &&
        !canManage
    ){
        schedulesMenu.remove();
    }

    if(
        staffMenu &&
        !canManage
    ){
        staffMenu.remove();
    }

}

document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        if(
            localStorage.getItem(
                "token"
            )
        ){

            showCurrentUser();

            applyMenuPermissions();

        }

    }
);



function canCreateFlight(){

    const user =
    getCurrentUser();

    if(!user){
        return false;
    }

    return [

        "OPERATIONS_DM",
        "TRAFFIC_COORDINATOR"

    ].includes(
        user.position
    );

}