package gov.doj.ustp.entities;

import java.util.HashMap;

public class ReviewCodeDescriptionLookUp {

  private static HashMap<String, String> mapper = new HashMap<>();

  public ReviewCodeDescriptionLookUp() {
    initializeMapper();
  }

  private static void initializeMapper() {
    mapper.put("CL", "CANCELLED");
    mapper.put("CT", "CONTINUED");
    mapper.put("HD", "HELD");
    mapper.put("NS", "NO SHOW");
    mapper.put("RS", "RESCHEDULED");
  }

  public static String getDescription(String reviewCode) {
    if (mapper.containsKey(reviewCode)) {
      return mapper.get(reviewCode);
    } else return " ";
  }
}
