package gov.doj;

import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;

public class CaseListTest {

    @Test
    public void testGetCases(){

        given().when().get("/cases").then().statusCode(204);
    }
}
