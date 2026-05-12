# FightingSchool

Fighting School white-label management application.

## Projects

- `src/FightFlow.Api` - ASP.NET Core API with in-memory FightFlow sample data.
- `src/FightFlow.Web` - Angular application using Angular Material.
- `src/FightFlow.Domain` - core tenant, user, student, attendance, and rank domain model.

## Run Locally

Start the API:

```powershell
dotnet run --project src/FightFlow.Api
```

Start the Angular app in a second terminal:

```powershell
cd src/FightFlow.Web
npm start
```

Open `http://localhost:4200`. The Angular dev server proxies `/api` requests to `http://localhost:5152`.

## Verify

```powershell
dotnet build FightFlow.slnx
cd src/FightFlow.Web
npm run build
```
