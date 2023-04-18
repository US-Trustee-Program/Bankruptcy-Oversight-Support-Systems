package gov.doj.adapters.controllers;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import gov.doj.entities.Case;
import gov.doj.usecases.CasesUseCase;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

@Path("/cases")
public class CaseListController {

  private CasesUseCase caseUseCase = new CasesUseCase();

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public String getCases(@QueryParam("prof_code") Integer userProfCode)
      throws JsonProcessingException {
    if (userProfCode == null) {
      List<Case> cases = caseUseCase.getCases();

      ObjectMapper objectMapper = new ObjectMapper();
      String json = objectMapper.writeValueAsString(cases);

      return json;
    } else {
      Map<String, List<String>> caseMap = caseUseCase.getCasesByProfCode(userProfCode);

      ObjectMapper objectMapper = new ObjectMapper();
      String json = objectMapper.writeValueAsString(caseMap);

      return json;
    }
  }

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Path("/{caseId}")
  public String getCaseById(long caseId) throws JsonProcessingException {

    Optional<Case> bCase = caseUseCase.getCaseById(caseId);

    Case caseValue = bCase.get();
    if (caseValue.getCases_id() == 0) {
      return "No Cases found with case Id : " + " " + caseId;
    } else {

      ObjectMapper objectMapper = new ObjectMapper();
      String json = objectMapper.writeValueAsString(bCase.get());

      return json;
    }
  }

  @Consumes(MediaType.APPLICATION_JSON)
  @POST
  @Path("/create")
  public boolean create(String payload) {
    long val = 0L; // case id generation value.
    Case obj = new Case(val, "Betty", "Gates2", "Complete", Timestamp.from(Instant.now()), 3);
    var response = Response.ok(caseUseCase.createCase(obj)).build();
    return false;
  }

  @Consumes(MediaType.APPLICATION_JSON)
  @PUT
  @Path("/{caseId}")
  public boolean update(long caseId, String payload) {
    Case obj = new Case(caseId, "Betty", "Gates2", "Complete", Timestamp.from(Instant.now()), 3);
    var response = Response.ok(caseUseCase.updateCase(obj)).build();
    return false;
  }

  @Produces(MediaType.APPLICATION_JSON)
  @DELETE
  @Path("/{caseId}")
  public boolean delete(long caseId) {
    return caseUseCase.deleteCase(caseId);
  }
}
