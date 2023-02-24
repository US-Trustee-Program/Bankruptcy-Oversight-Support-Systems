package gov.doj.adapters.controllers;

import gov.doj.RuntimeObjectFactory;
import gov.doj.usecases.CaseListUseCase;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.util.*;

@Path("/cases")
public class CaseListController {
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public List<String> getCases() {
        CaseListUseCase useCase = new CaseListUseCase();
        return useCase.getCases("");
    }
}
