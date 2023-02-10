package gov.doj;

import com.nimbusds.oauth2.sdk.AccessTokenResponse;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Path("/")
public class GreetingResource {

    GreetingResource(){

        RuntimeObjectFactory.init();

    }

    @Path("/hello")
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public void hello() {
        CaseListUseCase useCase = new CaseListUseCase();
        useCase.addCase("");
    }

    @Path("/getCases")
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public void getCases()
    {
        CaseListUseCase useCase = new CaseListUseCase();
        useCase.getCases("");
    }
}
