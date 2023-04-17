package gov.doj.ustp;

import gov.doj.ustp.entities.Case;
import gov.doj.ustp.entities.User;

import java.sql.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import static gov.doj.ustp.SqlQueryConstants.CASE_LIST_QUERY;
import static gov.doj.ustp.SqlQueryConstants.PROF_CODE_QUERY;

public class SqlServerGateway {
  private final String uri = System.getenv("SQL_SERVER_CONN_STRING");

  public List<User> getProfessionals(String firstName, String lastName) {
    try (Connection conn = DriverManager.getConnection(uri);
         PreparedStatement stmt = conn.prepareStatement(PROF_CODE_QUERY)) {
      stmt.setString(1, firstName);
      stmt.setString(2, lastName);
      ResultSet rs = stmt.executeQuery();
      List<User> professionals = new ArrayList<>();
      while (rs.next()) {
        Integer profCode = rs.getInt("UST_PROF_CODE");
        firstName = rs.getString("PROF_FIRST_NAME").trim();
        lastName = rs.getString("PROF_LAST_NAME").trim();
        String middleInitial = rs.getString("PROF_MI").trim();
        professionals.add(new User(profCode, firstName, lastName, middleInitial));
      }
      return professionals;
    } catch (SQLException e) {
      System.out.println(e.getMessage());
      throw new RuntimeException(e);
    }
  }

  public List<Case> getCases(String chapter, Integer professionalCode) {
    List<Case> cases = new ArrayList<>();
    try (Connection conn = DriverManager.getConnection(uri);
         PreparedStatement stmt = conn.prepareStatement(CASE_LIST_QUERY)) {
      stmt.setString(1, chapter);
      stmt.setInt(2, professionalCode);
      stmt.setInt(3, professionalCode);
      ResultSet rs = stmt.executeQuery();

      while (rs.next()) {
        Case caseObj = new Case();
        caseObj.setCurrentCaseChapter(rs.getString("CURR_CASE_CHAPT"));
        String caseNumber = rs.getString("CASE_YEAR_AND_NUMBER");
        while (caseNumber.length() < 8) {
          caseNumber = caseNumber.substring(0, 3) + "0" + caseNumber.split("-")[1];
        }
        caseObj.setCaseNumber(caseNumber);
        caseObj.setDebtor1Name(rs.getString("DEBTOR1_NAME"));
        caseObj.setCurrentChapterFileLocalDate(getLocalDate(rs.getString("CURRENT_CHAPTER_FILE_DATE")));
        caseObj.setStaff1ProfName(rs.getString("STAFF1_PROF_NAME"));
        caseObj.setStaff1ProfDescription(rs.getString("STAFF1_PROF_TYPE_DESC"));
        caseObj.setStaff2ProfName(rs.getString("STAFF2_PROF_NAME"));
        caseObj.setStaff2ProfDescription(rs.getString("STAFF2_PROF_TYPE_DESC"));
        caseObj.setHearingLocalDateTime(getLocalDateTime(rs.getString("HEARING_DATE"), rs.getString("HEARING_TIME")));
        caseObj.setHearingCode(rs.getString("HEARING_CODE"));
        caseObj.setHearingDisposition(rs.getString("HEARING_DISP"));
        cases.add(caseObj);
      }

      return cases;
    } catch (SQLException e) {
      System.out.println(e.getMessage());
      throw new RuntimeException(e);
    }
  }

  private LocalDate getLocalDate(String dateString) {
    int length = dateString.length();
    int dayOfMonth = Integer.parseInt(dateString.substring(length-2, length));
    int month = Integer.parseInt(dateString.substring(length-4, length-2));
    int year = Integer.parseInt(dateString.substring(0, length-4));
    return LocalDate.of(year, month, dayOfMonth);
  }

  private LocalTime getLocalTime(String timeString) {
    int hour;
    int minute;
    if (timeString.length() == 3) {
      hour = Integer.parseInt(timeString.substring(0, 1));
      minute = Integer.parseInt(timeString.substring(1));
    } else {
      hour = Integer.parseInt(timeString.substring(0, 2));
      minute = Integer.parseInt(timeString.substring(2));
    }
    return LocalTime.of(hour, minute);
  }

  private LocalDateTime getLocalDateTime(String dateString, String timeString) {
    if (dateString.equals("0") || timeString.equals("0")) {
      return null;
    }
    return LocalDateTime.of(getLocalDate(dateString), getLocalTime(timeString));
  }
}

