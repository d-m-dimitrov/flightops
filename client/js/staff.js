checkAuth();

const user =
getCurrentUser();

if(
    user.role !== "ADMIN"
    &&
    user.position !== "OPERATIONS_DM"
){
    window.location =
    "flights.html";
}


const positions = {

    OPERATIONS:[

        "OPERATIONS_DM",
        "TRAFFIC_COORDINATOR",
        "DISPATCHER"

    ],

    PASSENGER_HANDLING:[

        "PAX_DM",
        "CHECKIN_SUPERVISOR",
        "GATE_LEAD"

    ],

    RAMP:[

        "RAMP_DM",
        "RAMP_ALLOCATOR",
        "RAMP_SUPERVISOR"

    ],

    SPUR:[

        "SPUR_DM",
        "SPUR_COORDINATOR",
        "SPUR_SUPERVISOR"

    ]

};

let userModal;
let roles = [];

document.addEventListener(
    "DOMContentLoaded",
    async ()=>{

        userModal =
        new bootstrap.Modal(
            document.getElementById(
                "userModal"
            )
        );

        document
        .getElementById(
            "userDepartment"
        )
        .addEventListener(
            "change",
            loadPositions
        );

        renderSkills();

        loadPositions();

        await loadUsers();

    }
);

async function loadRoles(){

    const response =
    await fetch(
        "/api/role-definitions"
    );

    roles =
    await response.json();

}

async function newUser(){

    document.getElementById(
        "userId"
    ).value = "";

    document.getElementById(
        "userName"
    ).value = "";

    document.getElementById(
        "userPhone"
    ).value = "";

    document.getElementById(
        "userEmail"
    ).value = "";

    document.getElementById(
        "userDepartment"
    ).value =
    "OPERATIONS";

    loadPositions();

    document.getElementById(
        "userPosition"
    ).value =
    "DISPATCHER";

    document.getElementById(
        "userPassword"
    ).value =
    "";

    document.getElementById(
        "userActive"
    ).checked =
    true;

    renderSkills([]);

    userModal.show();

}

/*
function renderRoles(
    selectedRoles
){

    const panel =
    document.getElementById(
        "roleList"
    );

    panel.innerHTML = "";

    roles.forEach(role=>{

        panel.innerHTML += `

        <div class="form-check">

            <input
                class="form-check-input role-checkbox"

                type="checkbox"

                value="${role.code}"

                ${
                    selectedRoles.includes(
                        role.code
                    )
                    ?
                    "checked"
                    :
                    ""
                }>

            <label
                class="form-check-label">

                ${role.name}

            </label>

        </div>

        `;

    });

}

*/
async function saveUser(){

    const name =
    document.getElementById(
        "userName"
    ).value;

    const phone =
    document.getElementById(
        "userPhone"
    ).value;

    const email =
    document.getElementById(
        "userEmail"
    ).value;

    const department =
    document.getElementById(
        "userDepartment"
    ).value;

    const position =
    document.getElementById(
        "userPosition"
    ).value;

    const password =
    document.getElementById(
        "userPassword"
    ).value;

    const active =
    document.getElementById(
        "userActive"
    ).checked;

    const skills = [];

    document
    .querySelectorAll(
        ".skill-checkbox:checked"
    )
    .forEach(cb=>{

        skills.push(
            cb.value
        );

    });

    const userId =
    document.getElementById(
        "userId"
    ).value;

    let user;

    if(userId){

        const response =
        await fetch(

            `/api/users/${userId}`,

            {

                method:"PUT",

                headers:{
                    "Content-Type":
                    "application/json"
                },

                body:JSON.stringify({

                    name,
                    phone,
                    email,

                    department,
                    position,
                    skills,

                    password,
                    active

                })

            }

        );

        user =
        await response.json();

    }
    else{

        const response =
        await fetch(

            "/api/users",

            {

                method:"POST",

                headers:{
                    "Content-Type":
                    "application/json"
                },

                body:JSON.stringify({

                    name,
                    phone,
                    email,

                    department,
                    position,
                    skills,

                    password,
                    active

                })

            }

        );

        user =
        await response.json();

    }

    userModal.hide();

    await loadUsers();

}

async function loadUsers(){

    const response =
    await fetch(
        "/api/users"
    );

    const users =
    await response.json();

    const panel =
    document.getElementById(
        "staffList"
    );

    panel.innerHTML = "";

    for(const user of users){

        const skillsText =

        (user.skills || [])
        .join(", ");

        panel.innerHTML += `

        <div class="card mb-3">

            <div class="card-body">

                <h5>

                ${user.name}

                </h5>

                <div>

                📞 ${user.phone || "-"}

                </div>

                <div>

                📧 ${user.email || "-"}

                </div>

                <div class="mt-2">

                🏢
                ${user.department || "-"}

                </div>

                <div>

                👔
                ${user.position || "-"}

                </div>

                <div>

                🛠
                ${skillsText || "-"}

                </div>

                <div class="mt-2">

                ${
                    user.active !== false
                    ?
                    "🟢 Active"
                    :
                    "🔴 Disabled"
                }

                </div>

                <button
                    class="btn btn-primary btn-sm mt-3"
                    onclick="
                    editUser(
                    '${user._id}'
                    )
                    ">

                    Edit

                </button>

            </div>

        </div>

        `;

    }

}


function loadPositions(){

    const department =
    document.getElementById(
        "userDepartment"
    ).value;

    const select =
    document.getElementById(
        "userPosition"
    );

    select.innerHTML = "";

    positions[
        department
    ].forEach(position=>{

        select.innerHTML += `

        <option
            value="${position}">

            ${position}

        </option>

        `;

    });

}

function renderSkills(
    selected = []
){

    const skills = [

        "DISPATCH",

        "CHECKIN",

        "GATE",

        "ARRIVAL",

        "RAMP",

        "SPUR"

    ];

    const panel =
    document.getElementById(
        "skillList"
    );

    panel.innerHTML = "";

    skills.forEach(skill=>{

        panel.innerHTML += `

        <div class="form-check">

            <input

                class="form-check-input skill-checkbox"

                type="checkbox"

                value="${skill}"

                ${
                    selected.includes(
                        skill
                    )
                    ?
                    "checked"
                    :
                    ""
                }>

            <label
                class="form-check-label">

                ${skill}

            </label>

        </div>

        `;

    });

}

async function editUser(
    userId
){

    const userResponse =
    await fetch(
        `/api/users/${userId}`
    );

    const user =
    await userResponse.json();

    document.getElementById(
        "userId"
    ).value =
    user._id;

    document.getElementById(
        "userName"
    ).value =
    user.name || "";

    document.getElementById(
        "userPhone"
    ).value =
    user.phone || "";

    document.getElementById(
        "userEmail"
    ).value =
    user.email || "";

    document.getElementById(
        "userDepartment"
    ).value =
    user.department ||
    "OPERATIONS";

    loadPositions();

    document.getElementById(
        "userPosition"
    ).value =
    user.position ||
    "";

    document.getElementById(
        "userPassword"
    ).value =
    "";

    document.getElementById(
        "userActive"
    ).checked =
    user.active !== false;

    renderSkills(
        user.skills || []
    );

    userModal.show();

}



