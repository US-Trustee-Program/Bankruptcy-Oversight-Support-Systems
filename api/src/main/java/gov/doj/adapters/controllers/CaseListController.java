package gov.doj.adapters.controllers;

import gov.doj.usecases.CasesUseCase;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.util.List;

@Path("/cases")
public class CaseListController {

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public List<String> getCases() {

        CasesUseCase caseUseCase = new CasesUseCase()
;        return caseUseCase.getCases();
    }
}
