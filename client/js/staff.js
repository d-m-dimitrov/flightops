checkAuth();

let allUsers = [];
let qualificationRevision = 0;
let employeeSortColumn = 'name';
let employeeSortAscending = true;
let employeePage = 1;
const employeePageSize = 15;
let staffEditToken = null;

const user =
getCurrentUser();

if(
    user.role !== "ADMIN"
    &&
    !["OPERATIONS_DM","PAX_DM","RAMP_DM","SPUR_DM"].includes(user.position)
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
        () => {employeePage = 1;loadUsers();}

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
            () => { loadPositions(); renderSkills([]); renderQualifications([]); }
        );

        if (user.role !== 'ADMIN') {
            for (const id of ['userDepartment','filterDepartment']) {
                const select = document.getElementById(id);
                for (const option of [...select.options]) if (option.value !== user.department) option.remove();
                select.value = user.department;select.disabled = true;
            }
        }
        if (user.role !== 'ADMIN') {
            for (const id of ['userEmail','userPassword','userActive']) document.getElementById(id).disabled = true;
        }
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
    user.department || "OPERATIONS";

    loadPositions();

    document.getElementById(
        "userPosition"
    ).value =
    positions[document.getElementById("userDepartment").value].at(-1);

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
    const trainingLink=document.getElementById('trainingLink');if(trainingLink){trainingLink.href='#';trainingLink.classList.add('disabled');trainingLink.setAttribute('aria-disabled','true');}
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
                    ...(getCurrentUser().role === 'ADMIN' ? {email, password, active} : {}),

                    department,
                    position,
                    skills,
                    airlineQualifications,
                    expectedQualificationRevision:qualificationRevision,


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
                    ...(getCurrentUser().role === 'ADMIN' ? {email, password, active} : {}),

                    department,
                    position,
                    skills,
                    airlineQualifications,
                    expectedQualificationRevision:qualificationRevision

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
const sortFields = {NAME:'name',DEPARTMENT:'department',POSITION:'position'};
if (employeeSortColumn === 'name' && sortFields[sort] && sort !== 'NAME') employeeSortColumn = sortFields[sort];
const fieldValue = e => ({
    name:e.name || '',department:e.department || '',position:e.position || '',
    phone:e.phone || '',email:e.email || '',
    skills:(e.skills || []).map(AirlineQualifications.label).join(', '),
    qualifications:(e.airlineQualifications || []).length,
    active:e.active === false ? 0 : 1
}[employeeSortColumn] ?? '');
users.sort((a,b) => {
    const x=fieldValue(a),y=fieldValue(b);
    const result=typeof x==='number' ? x-y : String(x).localeCompare(String(y));
    return (employeeSortAscending?result:-result) || (a.name||'').localeCompare(b.name||'');
});
const totalPages=Math.max(1,Math.ceil(users.length/employeePageSize));
employeePage=Math.min(employeePage,totalPages);
const visibleUsers=users.slice((employeePage-1)*employeePageSize,employeePage*employeePageSize);

    const panel = document.getElementById("staffList");
    panel.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive border rounded bg-white';
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover align-middle mb-0';
    const thead = document.createElement('thead');
    thead.className = 'table-light';
    const header = document.createElement('tr');
    for (const [label,key] of [['Name','name'],['Department','department'],['Position','position'],['Phone','phone'],['Email','email'],['Skills','skills'],['Qualifications','qualifications'],['Status','active'],['Actions',null]]) {
        const th=document.createElement('th');th.scope='col';
        if(key){const button=document.createElement('button');button.type='button';button.className='btn btn-link p-0 text-decoration-none text-dark fw-semibold';button.textContent=label+(employeeSortColumn===key?(employeeSortAscending?' ▲':' ▼'):' ↕');button.onclick=()=>{if(employeeSortColumn===key)employeeSortAscending=!employeeSortAscending;else{employeeSortColumn=key;employeeSortAscending=true;}employeePage=1;loadUsers();};th.append(button);}
        else th.textContent=label;
        header.append(th);
    }
    thead.append(header);
    const tbody=document.createElement('tbody');
    for (const employee of visibleUsers) {
        const tr=document.createElement('tr');
        const fields=[
            employee.name || '—',
            employee.department || '—',
            employee.position || '—',
            employee.phone || '—',
            employee.email || '—',
            (employee.skills || []).map(AirlineQualifications.label).join(', ') || '—',
            String((employee.airlineQualifications || []).length)
        ];
        for(const value of fields){
            const td=document.createElement('td');td.textContent=value;tr.append(td);
        }
        const status=document.createElement('td');
        const badge=document.createElement('span');
        badge.className='badge '+(employee.active!==false?'text-bg-success':'text-bg-secondary');
        badge.textContent=employee.active!==false?'Active':'Disabled';
        status.append(badge);tr.append(status);
        const action=document.createElement('td');
        const button=document.createElement('button');
        button.type='button';button.className='btn btn-sm btn-outline-primary';
        button.textContent='Edit';button.addEventListener('click',()=>editUser(employee._id));
        action.append(button);tr.append(action);tbody.append(tr);
    }
    if(!users.length){
        const tr=document.createElement('tr'),td=document.createElement('td');
        td.colSpan=9;td.className='text-center text-muted py-4';td.textContent='No employees match the selected filters.';
        tr.append(td);tbody.append(tr);
    }
    table.append(thead,tbody);wrapper.append(table);panel.append(wrapper);
    const footer=document.createElement('div');footer.className='d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2';
    const info=document.createElement('span');info.className='text-muted small';info.textContent=users.length ? 'Showing '+((employeePage-1)*employeePageSize+1)+'–'+Math.min(employeePage*employeePageSize,users.length)+' of '+users.length+' employees' : '0 employees';
    const controls=document.createElement('div');controls.className='btn-group';
    for(const [label,delta] of [['Previous',-1],['Next',1]]){const b=document.createElement('button');b.type='button';b.className='btn btn-sm btn-outline-secondary';b.textContent=label;b.disabled=delta<0?employeePage<=1:employeePage>=totalPages;b.onclick=()=>{employeePage+=delta;loadUsers();};controls.append(b);}
    const pages=document.createElement('span');pages.className='btn btn-sm btn-light disabled';pages.textContent='Page '+employeePage+' / '+totalPages;controls.insertBefore(pages,controls.children[1]);footer.append(info,controls);panel.append(footer);
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

        "ARRIVAL_RAMP",
        "RAMP",

        "SPUR"

    ];

    const panel =
    document.getElementById(
        "skillList"
    );

    panel.innerHTML = "";

    skills.filter(skill=>skill !== 'ARRIVAL_RAMP' && staffDepartmentRoles().includes(skill)).forEach(skill=>{

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
    const trainingLink=document.getElementById('trainingLink');
    if(trainingLink){trainingLink.href='training.html?id='+encodeURIComponent(user._id);trainingLink.classList.remove('disabled');trainingLink.removeAttribute('aria-disabled');}
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
        if(type==='select')for(const role of staffDepartmentRoles().filter(role=>role !== 'ARRIVAL_RAMP' || value.role === role))input.append(new Option(AirlineQualifications.label(role),role));
        else input.type=type;
        if(field==='airline'){input.maxLength=3;input.placeholder='SQ';input.style.textTransform='uppercase';}
        input.value=value[field] || (field==='role'?staffDepartmentRoles().find(role=>role !== 'ARRIVAL_RAMP'):'');label.append(input);row.append(label);
    }
    const remove=document.createElement('button');remove.type='button';remove.className='btn btn-outline-danger btn-sm col-sm-3';remove.textContent='Remove';remove.onclick=()=>row.remove();row.append(remove);
    document.getElementById('qualificationRows').append(row);
}

function staffDepartmentRoles(){return {OPERATIONS:['DISPATCH','ARRIVAL_DISPATCH'],PASSENGER_HANDLING:['CHECKIN','GATE','ARRIVAL'],RAMP:['ARRIVAL_RAMP','RAMP'],SPUR:['SPUR']}[document.getElementById('userDepartment').value] || [];}
