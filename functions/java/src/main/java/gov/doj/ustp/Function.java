package gov.doj.ustp;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.microsoft.azure.functions.ExecutionContext;
import com.microsoft.azure.functions.HttpMethod;
import com.microsoft.azure.functions.HttpRequestMessage;
import com.microsoft.azure.functions.HttpResponseMessage;
import com.microsoft.azure.functions.HttpStatus;
import com.microsoft.azure.functions.annotation.AuthorizationLevel;
import com.microsoft.azure.functions.annotation.FunctionName;
import com.microsoft.azure.functions.annotation.HttpTrigger;
import gov.doj.ustp.entities.BossResponse;
import gov.doj.ustp.entities.Case;
import gov.doj.ustp.entities.User;
import gov.doj.ustp.entities.UserRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public class Function {

  @FunctionName("cases")
  public HttpResponseMessage getCases(
      @HttpTrigger(
              name = "req",
              methods = {HttpMethod.GET},
              authLevel = AuthorizationLevel.ANONYMOUS)
          HttpRequestMessage<Optional<String>> request,
      final ExecutionContext context) {

    final Integer professionalId =
        Integer.parseInt(request.getQueryParameters().get("professional_id"));
    final String chapter = request.getQueryParameters().get("chapter");

    SqlServerGateway sqlServerGateway = new SqlServerGateway();
    List<Case> cases = sqlServerGateway.getCases(chapter, professionalId);
    BossResponse response = new BossResponse.Builder().count(cases.size()).body(cases).build();
    Gson gson =
        new GsonBuilder()
            .registerTypeAdapter(LocalDate.class, new LocalDateAdapter())
            .registerTypeAdapter(LocalDateTime.class, new LocalDateTimeAdapter())
            .create();

    return request.createResponseBuilder(HttpStatus.OK).body(gson.toJson(response)).build();
  }

  @FunctionName("login")
  public HttpResponseMessage login(
      @HttpTrigger(
              name = "req",
              methods = {HttpMethod.POST},
              authLevel = AuthorizationLevel.ANONYMOUS,
              route = "users/login")
          HttpRequestMessage<Optional<String>> request,
      final ExecutionContext context) {

    // Get first and last names from Query Params
    final String firstNameQuery = request.getQueryParameters().get("first_name");
    final String lastNameQuery = request.getQueryParameters().get("last_name");
    String firstName = firstNameQuery;
    String lastName = lastNameQuery;

    // Try-get first and last names from the request body, if present
    String requestBody = request.getBody().orElse("{}");
    UserRequest userRequest = new Gson().fromJson(requestBody, UserRequest.class);
    if (userRequest.getFirstName() != null && userRequest.getLastName() != null) {
      firstName = userRequest.getFirstName();
      lastName = userRequest.getLastName();
    }

    Gson gson = new GsonBuilder().create();
    if (firstName == null || lastName == null) {
      BossResponse response =
          new BossResponse.Builder()
              .message("Please pass a first_name and last_name on the query string.")
              .build();
      return request
          .createResponseBuilder(HttpStatus.BAD_REQUEST)
          .body(gson.toJson(response))
          .build();
    } else {
      SqlServerGateway sqlServerGateway = new SqlServerGateway();
      List<User> professionals = sqlServerGateway.getProfessionals(firstName, lastName);
      if (professionals == null) {
        BossResponse response =
            new BossResponse.Builder().message("No professionals by that name was found.").build();
        return request
            .createResponseBuilder(HttpStatus.NOT_FOUND)
            .body(gson.toJson(response))
            .build();
      }
      BossResponse response = new BossResponse.Builder().body(professionals).build();
      return request.createResponseBuilder(HttpStatus.OK).body(gson.toJson(response)).build();
    }
  }
}
