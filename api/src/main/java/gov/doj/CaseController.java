package gov.doj;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.util.List;

@Path("/case")
public class CaseController {

    @GET
    @Path("/hello")
    @Produces(MediaType.TEXT_PLAIN)
    public String getCases(){
        return "Hello Case Test!";
    }

    @GET
    @Path("/cases")
    @Produces(MediaType.TEXT_PLAIN)
    public List<String> getCasesFromAzure(){

        AzureGateway gateway = new AzureGateway();

        try {

            return gateway.connectWithSecret();

        } catch (Exception e) {

            throw new RuntimeException(e);
        }
    }
}
