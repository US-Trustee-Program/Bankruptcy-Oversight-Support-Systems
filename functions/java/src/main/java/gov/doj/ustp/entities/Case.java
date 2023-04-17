package gov.doj.ustp.entities;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

public class Case {
  private String caseNumber;
  private LocalDate currentChapterFileLocalDate;
  private Long currentChapterFileDate;
  private String currentCaseChapter;
  private String debtor1Name;
  private String hearingCode;
  private LocalDateTime hearingLocalDateTime;
  private Long hearingDate;
  private Integer hearingTime;
  private String hearingDisposition;
  private String staff1ProfName;
  private String staff1ProfDescription;
  private String staff2ProfName;
  private String staff2ProfDescription;

  public String getCaseNumber() {
    return caseNumber;
  }

  public void setCaseNumber(String caseNumber) {
    this.caseNumber = caseNumber;
  }

  public LocalDate getCurrentChapterFileLocalDate() {
    return currentChapterFileLocalDate;
  }

  public void setCurrentChapterFileLocalDate(LocalDate currentChapterFileLocalDate) {
    this.currentChapterFileLocalDate = currentChapterFileLocalDate;
    this.currentChapterFileDate =
        Long.parseLong(currentChapterFileLocalDate.toString().replaceAll("-", ""));
  }

  public String getCurrentCaseChapter() {
    return currentCaseChapter;
  }

  public void setCurrentCaseChapter(String currentCaseChapter) {
    this.currentCaseChapter = currentCaseChapter;
  }

  public String getDebtor1Name() {
    return debtor1Name;
  }

  public void setDebtor1Name(String debtor1Name) {
    this.debtor1Name = debtor1Name;
  }

  public String getHearingCode() {
    return hearingCode;
  }

  public void setHearingCode(String hearingCode) {
    this.hearingCode = hearingCode;
  }

  public LocalDateTime getHearingLocalDateTime() {
    return hearingLocalDateTime;
  }

  public void setHearingLocalDateTime(LocalDateTime hearingLocalDateTime) {
    this.hearingLocalDateTime = hearingLocalDateTime;
    if (Objects.nonNull(hearingLocalDateTime)) {
      this.hearingDate =
          Long.parseLong(hearingLocalDateTime.toLocalDate().toString().replaceAll("-", ""));
      this.hearingTime =
          Integer.parseInt(hearingLocalDateTime.toLocalTime().toString().replaceAll(":", ""));
    }
  }

  public String getHearingDisposition() {
    return hearingDisposition;
  }

  public void setHearingDisposition(String hearingDisposition) {
    this.hearingDisposition = hearingDisposition;
  }

  public String getStaff1ProfName() {
    return staff1ProfName;
  }

  public void setStaff1ProfName(String staff1ProfName) {
    this.staff1ProfName = staff1ProfName;
  }

  public String getStaff1ProfDescription() {
    return staff1ProfDescription;
  }

  public void setStaff1ProfDescription(String staff1ProfDescription) {
    this.staff1ProfDescription = staff1ProfDescription;
  }

  public String getStaff2ProfName() {
    return staff2ProfName;
  }

  public void setStaff2ProfName(String staff2ProfName) {
    this.staff2ProfName = staff2ProfName;
  }

  public String getStaff2ProfDescription() {
    return staff2ProfDescription;
  }

  public void setStaff2ProfDescription(String staff2ProfDescription) {
    this.staff2ProfDescription = staff2ProfDescription;
  }
}
