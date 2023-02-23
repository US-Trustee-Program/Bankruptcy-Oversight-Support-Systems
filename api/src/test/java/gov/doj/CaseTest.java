package gov.doj;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

@QuarkusTest
public class CaseTest {

    @Test
    public void testCaseEndPoint(){
        given()
                .when().get("/case")
                .then()
                .statusCode(200)
                .body(is("Hello Case Test!"));

    }
}
