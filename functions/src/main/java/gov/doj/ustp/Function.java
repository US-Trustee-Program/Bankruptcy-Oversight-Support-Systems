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
import gov.doj.ustp.entities.Case;
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

        final Integer professionalId = Integer.parseInt(request.getQueryParameters().get("professional_id"));

        SqlServerGateway sqlServerGateway = new SqlServerGateway();
        List<Case> cases = sqlServerGateway.getCases("11", professionalId);
        Gson gson = new GsonBuilder()
            .registerTypeAdapter(LocalDate.class, new LocalDateAdapter())
            .registerTypeAdapter(LocalDateTime.class, new LocalDateTimeAdapter())
            .create();

        return request.createResponseBuilder(HttpStatus.OK).body(gson.toJson(cases)).build();
    }

    @FunctionName("login")
    public HttpResponseMessage login(
        @HttpTrigger(
            name = "req",
            methods = {HttpMethod.POST},
            authLevel = AuthorizationLevel.ANONYMOUS)
        HttpRequestMessage<Optional<String>> request,
        final ExecutionContext context) {

        final String firstNameQuery = request.getQueryParameters().get("first_name");
        final String lastNameQuery = request.getQueryParameters().get("last_name");
        String firstName = firstNameQuery;
        String lastName = lastNameQuery;

        String requestBody = request.getBody().orElse("{}");

        if (requestBody != null) {
            UserRequest userRequest = new Gson().fromJson(requestBody, UserRequest.class);
            firstName = userRequest.getFirstName();
            lastName = userRequest.getLastName();
        }

        if (firstName == null || lastName == null) {
            return request.createResponseBuilder(HttpStatus.BAD_REQUEST).body("Please pass a first_name and last_name on the query string").build();
        } else {
            SqlServerGateway sqlServerGateway = new SqlServerGateway();
            Integer professionalId = sqlServerGateway.getProfCode(firstName, lastName);
            if (professionalId == null) {
                return request.createResponseBuilder(HttpStatus.NOT_FOUND).body("No professional by that name was found.").build();
            }
            return request.createResponseBuilder(HttpStatus.OK).body(professionalId).build();
        }
    }
}
