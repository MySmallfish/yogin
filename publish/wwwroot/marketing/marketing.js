const revealItems = document.querySelectorAll("[data-reveal]");

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 }
);

revealItems.forEach(item => observer.observe(item));

document.querySelectorAll("[data-scroll]").forEach(link => {
  link.addEventListener("click", event => {
    const target = link.getAttribute("href");
    if (!target || !target.startsWith("#")) return;
    event.preventDefault();
    const section = document.querySelector(target);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
