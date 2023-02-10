package gov.doj;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Path("/hello")
public class GreetingResource {

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public void hello() {
        RuntimeObjectFactory.init();
        CaseListUseCase useCase = new CaseListUseCase();
        useCase.addCase("");
    }
}
