package gov.doj;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.containsString;
import static io.restassured.RestAssured.given;

@QuarkusTest
public class CaseListTest {

    @Test
    public void testGetCases(){

        given().when().get("/cases").then().statusCode(204);
    }

    @Test
    public void testGetCasesEndPoint(){
        given()
                .when().get("/cases")
                .then()
                .statusCode(200)
                .body(containsString("abc"));

    }
}
