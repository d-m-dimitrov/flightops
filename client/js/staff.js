checkAuth();

let allUsers = [];
let qualificationRevision = 0;
let staffEditToken = null;

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

[
    "searchUser",
    "filterDepartment",
    "filterSkill",
    "filterStatus",
    "sortUsers"
]
.forEach(id=>{

    document
    .getElementById(id)
    ?.addEventListener(

        "input",
        loadUsers

    );

    document
    .getElementById(id)
    ?.addEventListener(

        "change",
        loadUsers

    );

});


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
    renderQualifications([]);
    qualificationRevision = 0;
    staffEditToken = localStorage.getItem('token');

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
    if (!staffEditToken || staffEditToken !== localStorage.getItem('token')) {alert('Account changed. Reopen the staff record.');return;}
    let airlineQualifications;
    try { airlineQualifications = AirlineQualifications.normalize([...document.querySelectorAll('.qualification-row')].map(row => ({
        airline:row.querySelector('[data-field="airline"]').value,
        role:row.querySelector('[data-field="role"]').value,
        validUntil:row.querySelector('[data-field="validUntil"]').value || null
    }))); } catch(error) {alert(error.message);return;}


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
                    Authorization:`Bearer ${localStorage.getItem("token") || ""}`,
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
                    airlineQualifications,
                    expectedQualificationRevision:qualificationRevision,

                    password,
                    active

                })

            }

        );

        if (!response.ok) { alert((await response.json()).error || "Unable to save staff"); return; }
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
                    Authorization:`Bearer ${localStorage.getItem("token") || ""}`,
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
                    airlineQualifications,
                    expectedQualificationRevision:qualificationRevision,

                    password,
                    active

                })

            }

        );

        if (!response.ok) { alert((await response.json()).error || "Unable to save staff"); return; }
        user =
        await response.json();

    }

    userModal.hide();

    await loadUsers();

}

async function loadUsers(){

    const response =
    await fetch(
        "/api/users", {headers:{Authorization:`Bearer ${localStorage.getItem("token") || ""}`}}
    );

 allUsers =
await response.json();

let users =
[...allUsers];


const search =

document
.getElementById(
    "searchUser"
)
?.value
?.toLowerCase()
|| "";

const department =

document
.getElementById(
    "filterDepartment"
)
?.value
|| "";

const skill =

document
.getElementById(
    "filterSkill"
)
?.value
|| "";

const status =

document
.getElementById(
    "filterStatus"
)
?.value
|| "";

const sort =

document
.getElementById(
    "sortUsers"
)
?.value
|| "NAME";


users = users.filter(user=>{

    const text =

        `${user.name || ""}
         ${user.email || ""}
         ${user.phone || ""}
         ${user.position || ""}`
        .toLowerCase();

    return text.includes(
        search
    );

});

if(department){

    users =
    users.filter(

        user =>

        user.department ===
        department

    );

}

if(skill){

    users =
    users.filter(

        user =>

        (user.skills || [])
        .includes(skill)

    );

}if(status === "ACTIVE"){

    users =
    users.filter(

        user =>

        user.active !== false

    );

}

if(status === "DISABLED"){

    users =
    users.filter(

        user =>

        user.active === false

    );

}
if(sort === "NAME"){

    users.sort((a,b)=>

        (a.name || "")
        .localeCompare(
            b.name || ""
        )

    );

}

if(sort === "DEPARTMENT"){

    users.sort((a,b)=>

        (a.department || "")
        .localeCompare(
            b.department || ""
        )

    );

}

if(sort === "POSITION"){

    users.sort((a,b)=>

        (a.position || "")
        .localeCompare(
            b.position || ""
        )

    );

}

    const panel =
    document.getElementById(
        "staffList"
    );

    panel.innerHTML = "";

    for(const user of users){

        const skillsText =

        (user.skills || []).map(AirlineQualifications.label)
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
                ${skillsText || "-"}<div class="small text-muted">Airline qualifications: ${(user.airlineQualifications || []).length}</div>

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

        "ARRIVAL_DISPATCH",

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

                ${AirlineQualifications.label(skill)}

            </label>

        </div>

        `;

    });

}

async function editUser(
    userId
){

    const editToken = localStorage.getItem('token');
    const userResponse =
    await fetch(
        `/api/users/${userId}`, {headers:{Authorization:`Bearer ${localStorage.getItem("token") || ""}`}}
    );

    if (!userResponse.ok) {alert('Unable to load staff record');return;}
    const user =
    await userResponse.json();
    if (!user || editToken !== localStorage.getItem('token')) {alert('Account changed or staff record unavailable. Reopen the editor.');return;}

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

    renderQualifications(user.airlineQualifications || []);
    qualificationRevision = user.qualificationRevision || 0;
    staffEditToken = editToken;
    userModal.show();

}




function renderQualifications(rows) {
    document.getElementById('qualificationRows').replaceChildren();
    rows.forEach(addQualificationRow);
}
function addQualificationRow(value = {}) {
    const row=document.createElement('div');row.className='qualification-row row g-2 align-items-end mb-3';
    for(const [field,title,type] of [['airline','Airline code','text'],['role','Role','select'],['validUntil','Valid until (optional)','date']]){
        const label=document.createElement('label');label.className='col-sm-3 small';label.textContent=title;
        const input=document.createElement(type==='select'?'select':'input');input.className=type==='select'?'form-select':'form-control';input.dataset.field=field;
        if(type==='select')for(const role of AirlineQualifications.roles)input.append(new Option(AirlineQualifications.label(role),role));
        else input.type=type;
        if(field==='airline'){input.maxLength=3;input.placeholder='SQ';input.style.textTransform='uppercase';}
        input.value=value[field] || (field==='role'?'DISPATCH':'');label.append(input);row.append(label);
    }
    const remove=document.createElement('button');remove.type='button';remove.className='btn btn-outline-danger btn-sm col-sm-3';remove.textContent='Remove';remove.onclick=()=>row.remove();row.append(remove);
    document.getElementById('qualificationRows').append(row);
}
