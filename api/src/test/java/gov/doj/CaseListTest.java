package gov.doj;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;

@QuarkusTest
public class CaseListTest {

    @BeforeAll
    public static void init()
    {
        TestObjectFactory.init();
    }
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
                .body(containsString("1"));

    }
}
