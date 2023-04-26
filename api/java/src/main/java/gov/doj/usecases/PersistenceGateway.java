package gov.doj.usecases;

import gov.doj.entities.Case;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface PersistenceGateway {
  List<Case> getCases();

  Map<String, List<String>> getCasesByProfCode(int userProfCode);

  Optional<Case> getCase(long caseId);

  boolean createCase(Case aCaseObj);

  boolean updateCase(Case aCaseObj);

  boolean deleteCase(long casesId);
}
