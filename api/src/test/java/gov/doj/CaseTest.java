package gov.doj;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.containsString;

@QuarkusTest
public class CaseTest {

    @Test
    public void testCaseHelloEndPoint(){
        given()
                .when().get("/case/hello")
                .then()
                .statusCode(200)
                .body(is("Hello Case Test!"));
    }

    @Test
    public void testGetCasesEndPoint(){
        given()
                .when().get("/case/cases")
                .then()
                .statusCode(200)
                .body(containsString("abc"));

    }
}
