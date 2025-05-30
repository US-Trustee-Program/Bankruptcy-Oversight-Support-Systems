# Slot Deployments

Azure provides deployment
slots for both App Services and Functions App resources. This provides a way to leave production uninterrupted
until the deployment has been validated, at which time a swap may be performed.

## Considerations

Since we own both the client and the API, we do not need to version our API, but this does mean that we should validate that both client and API deployments have succeeded prior to swapping the new code into the production slot. For now, we are simply running `curl` commands to get the newly deployed client and perform a health check of the API in the `staging` slot. Eventually we should get to a point where we can perform some end-to-end testing where actions that do not create or update data are performed on the newly deployed frontend, interacting with the newly deployed backend.

### Challenge

The challenge we came across when implementing slots was correctly hitting the endpoint for the appropriate slot. For the React app, we have a baked in URL at build time which points the frontend to a corresponding backend. This is problematic adequately test the integration of the webapp and backend of the new code deployed to the slot environment. We needed a solution which could handle the different endpoints properly without rebuilding the application.

### Options

There are many options for how to ensure the validation of the staged client is interacting with the staged API.
They generally involve tradeoffs so determining which method to use is not simple.

- Get the hostname from configuration at runtime. This involves providing some way for the client to get a configuration value and providing a different value only for use in validation. The client runs in browsers on users' machines, so the configuration value would need to come from a call to some API and only have value during deployment.
- Proxy requests in our validation runner (GitHub Actions or Azure DevOps) to hit the staged API instead of the production one. This involves setting up some proxy tooling in the runner.
- Add a header to all requests during validation. An Azure rep indicated that this would be an option. This would involve setting up something very similar to a proxy to capture requests and add a header, or changing code to add the header, but we would have to have some way to not do so from the users' machines.
- Use a `x-ms-routing-name` cookie with the value set to the name of the staged slot (i.e. `staging`).
- Create a multi-tier application in which all traffic to the API goes through the frontend server. https://learn.microsoft.com/en-us/azure/app-service/networking-features#create-multi-tier-applications
    - The same thing could be accomplished by setting up a proxy on the frontend server, but the built-in Azure way is likely a better option.
    - Issues with this: we still have a baked in host name for .env values which is not resolved here

### Implementation

- `x-ms-routing-name` cookie. A request to `https://api-hostname.azurewebsites.us/?x-ms-routing-name=staging` will trigger the creation of a cookie so subsequent requests will be routed to the staged API. This does require that at least temporarily we set up the routing to distribute some traffic to the staged slot. This can be done by running:

```shell
az webapp traffic-routing set --distribution staging=0 --name <app name> --resource-group <resource group name>
# this can be set to 0, Azure allows traffic even with a value of 0
az webapp traffic-routing clear --name <app name> -g <resource group name>
```
