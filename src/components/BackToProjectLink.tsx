// "BACK TO PROJECT" pill for the project proposal pages; same look as BackToDeskLink, but
// it returns to the project browser instead of the desk.
export function BackToProjectLink() {
  return (
    <a className="back-link" href="#/projects" aria-label="프로젝트 화면으로 돌아가기">
      <img className="back-arrow" src="/assets/arrow-back.svg" alt="" aria-hidden="true" />
      BACK TO PROJECT
    </a>
  );
}
