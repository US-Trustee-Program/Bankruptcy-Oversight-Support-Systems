package gov.doj.ustp.entities;

public class User {
  private Integer professionalId;
  private String firstName;
  private String lastName;
  private String middleInitial;

  public User(Integer professionalId, String firstName, String lastName, String middleInitial) {

    this.professionalId = professionalId;
    this.firstName = firstName;
    this.lastName = lastName;
    this.middleInitial = middleInitial;
  }

  public Integer getProfessionalId() {
    return professionalId;
  }

  public void setProfessionalId(Integer professionalId) {
    this.professionalId = professionalId;
  }

  public String getFirstName() {
    return firstName;
  }

  public void setFirstName(String firstName) {
    this.firstName = firstName;
  }

  public String getLastName() {
    return lastName;
  }

  public void setLastName(String lastName) {
    this.lastName = lastName;
  }

  public String getMiddleInitial() {
    return middleInitial;
  }

  public void setMiddleInitial(String middleInitial) {
    this.middleInitial = middleInitial;
  }
}
