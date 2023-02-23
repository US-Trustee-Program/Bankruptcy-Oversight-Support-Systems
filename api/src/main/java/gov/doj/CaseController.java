package gov.doj;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.util.ArrayList;
import java.util.List;

@Path("/case")
public class CaseController {

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public String getCases(){

        return "Hello Case Test!";
    }

    public String getCasesFromAzure(){

        return "";
    }
}
