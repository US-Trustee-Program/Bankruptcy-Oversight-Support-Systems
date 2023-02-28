package gov.doj.usecases;

import gov.doj.entities.Case;
import java.util.List;

public interface PersistenceGateway {
    List<String> getCases();

    List<String> getCase(long caseId);

    long createCase(Case aCaseObj);

    void updateCase(Case aCaseObj);

    void deleteCase(long casesId);
}
