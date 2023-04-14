package gov.doj;

import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

@QuarkusTest
public class CaseListTest {

  @BeforeAll
  public static void init() {
    TestObjectFactory.init();
  }

  @Test
  public void testGetCases() {
    given().when().get("/cases").then().statusCode(200);
  }
}
