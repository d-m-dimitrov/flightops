# Super Admin setup (Render)

1. In Render → service → Environment, set `SUPER_ADMIN_EMAIL` to a separate administrator email and `SUPER_ADMIN_PASSWORD` to a unique password of at least 16 characters. Optionally set `SUPER_ADMIN_NAME`.
2. Deploy the bootstrap commit. At startup the account is created in the configured MongoDB database. No password is printed in logs or stored in Git.
3. Sign in with that email and password. The login response includes the existing `ADMIN` system role, used for Super Admin.
4. After successful login, remove `SUPER_ADMIN_PASSWORD` from Render. You may remove all three setup variables. Subsequent deployments preserve the account and password.
5. Enable the department-access commit only after verifying the Super Admin login.

Setup refuses to promote an existing ordinary staff email, replace an existing different administrator, or reset a password. It refuses multiple existing administrators. New Super Admin creation uses a unique partial database index to prevent concurrent duplicate administrators.

Department-access rollout scopes staff records, training, allocation and shift management to each manager's department. Shared flight identifiers and schedule data remain common operational information. The Super Admin manages all departments. Airline qualifications remain mandatory for flight allocation, including for Super Admin.
