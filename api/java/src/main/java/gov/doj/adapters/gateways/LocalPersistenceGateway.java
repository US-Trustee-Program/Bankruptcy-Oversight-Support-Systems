package gov.doj.adapters.gateways;

import gov.doj.entities.Case;
import gov.doj.usecases.PersistenceGateway;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class LocalPersistenceGateway implements PersistenceGateway {
  List<String> caseList = new ArrayList<>();

  public LocalPersistenceGateway() {
    caseList.add(
        "Case Number: 477-14-12211, Chapter: 11, Debtor: Debby Debtor, Staff1: Brian"
            + " BusinessAnalyst");
    caseList.add(
        "Case Number: 477-14-12151, Chapter: 11, Debtor: Testy McTesterson, Staff1: Brian"
            + " BusinessAnalyst");
  }

  @Override
  public List<Case> getCases() {
    return new ArrayList<>();
  }

  @Override
  public Map<String, List<String>> getCasesByProfCode(int userProfCode) {
    return new HashMap<>();
  }

  @Override
  public Optional<Case> getCase(long caseId) {
    return null;
  }

  @Override
  public boolean createCase(Case aCaseObj) {
    return false;
  }

  @Override
  public boolean updateCase(Case aCaseObj) {

    return false;
  }

  @Override
  public boolean deleteCase(long casesId) {

    return false;
  }
}
