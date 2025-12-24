import './RawSvgIcon.scss';

export function GavelIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      fill="currentColor"
      width="1rem"
      height="1rem"
      className="gavel-icon"
      aria-label="Gavel Icon"
    >
      {/*!Font
        Awesome Free v7.0.0 by @fontawesome - https://fontawesome.com License -
        https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.*/}
      <path d="M201.6 217.4L182.9 198.7C170.4 186.2 170.4 165.9 182.9 153.4L297.6 38.6C310.1 26.1 330.4 26.1 342.9 38.6L361.6 57.4C374.1 69.9 374.1 90.2 361.6 102.7L246.9 217.4C234.4 229.9 214.1 229.9 201.6 217.4zM308 275.7L276.6 244.3L388.6 132.3L508 251.7L396 363.7L364.6 332.3L132.6 564.3C117 579.9 91.7 579.9 76 564.3C60.3 548.7 60.4 523.4 76 507.7L308 275.7zM422.9 438.6C410.4 426.1 410.4 405.8 422.9 393.3L537.6 278.6C550.1 266.1 570.4 266.1 582.9 278.6L601.6 297.3C614.1 309.8 614.1 330.1 601.6 342.6L486.9 457.4C474.4 469.9 454.1 469.9 441.6 457.4L422.9 438.7z" />
    </svg>
  );
}

export function LeadCaseIcon() {
  return (
    <svg
      className="raw-svg-icon lead-case-icon"
      data-testid="lead-case-icon"
      width="22"
      height="28"
      viewBox="0 0 22 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Lead Case Icon"
    >
      <path d="M0 25.5V2C0 0.89543 0.895431 0 2 0H15.125L22 6.875V25.5C22 26.6046 21.1046 27.5 20 27.5H2C0.895431 27.5 0 26.6046 0 25.5Z" />
      <path d="M16.5 17.875V22H8.25V17.875H12.1999H16.5ZM9.625 5.5V22H5.5V5.5H9.625Z" />
      <path d="M15.125 5.875V1.375L20.625 6.875H16.125C15.5727 6.875 15.125 6.42728 15.125 5.875Z" />
    </svg>
  );
}

export function MemberCaseIcon() {
  return (
    <svg
      className="raw-svg-icon member-case-icon"
      data-testid="member-case-icon"
      width="22"
      height="28"
      viewBox="0 0 22 28"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Associated Case Icon"
    >
      <path d="M0 25.5V2C0 0.89543 0.895431 0 2 0H15.125L22 6.875V25.5C22 26.6046 21.1046 27.5 20 27.5H2C0.895431 27.5 0 26.6046 0 25.5Z" />
      <path d="M15.125 5.875V1.375L20.625 6.875H16.125C15.5727 6.875 15.125 6.42728 15.125 5.875Z" />
    </svg>
  );
}

export function TransferredCaseIcon() {
  return (
    <svg
      className="raw-svg-icon transfer-icon"
      data-testid="transfer-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="28"
      viewBox="0 0 22 28"
      fill="currentColor"
      aria-label="Transfer Icon"
    >
      <path
        d="M0 25.5V2C0 0.89543 0.895431 0 2 0H15.125L22 6.875V25.5C22 26.6046 21.1046 27.5 20 27.5H2C0.895431 27.5 0 26.6046 0 25.5Z"
        fill="#005EA2"
      />
      <path
        d="M15.125 5.875V1.375L20.625 6.875H16.125C15.5727 6.875 15.125 6.42728 15.125 5.875Z"
        fill="white"
      />
      <path
        d="M9.0975 13.4138L7.51125 15L3 10.4887L7.51125 6L9.10875 7.58625L7.32 9.375H15V11.625H7.32L9.0975 13.4138Z"
        fill="#FEFFFF"
      />
      <path
        d="M12.9025 16.5862L14.4887 15L19 19.5113L14.4887 24L12.8912 22.4138L14.68 20.625H7V18.375H14.68L12.9025 16.5862Z"
        fill="#FEFFFF"
      />
    </svg>
  );
}
