package gov.doj.ustp.entities;

import java.util.List;

public class CaseListResponseBody {
  private String staff1Label;
  private String staff2Label;
  private List<Case> caseList;

  public CaseListResponseBody(String staff1Label, String staff2Label, List<Case> caseList) {
    this.staff1Label = staff1Label;
    this.staff2Label = staff2Label;
    this.caseList = caseList;
  }

  public String getStaff1Label() {
    return staff1Label;
  }

  public void setStaff1Label(String staff1Label) {
    this.staff1Label = staff1Label;
  }

  public String getStaff2Label() {
    return staff2Label;
  }

  public void setStaff2Label(String staff2Label) {
    this.staff2Label = staff2Label;
  }

  public List<Case> getCaseList() {
    return caseList;
  }

  public void setCaseList(List<Case> caseList) {
    this.caseList = caseList;
  }
}
