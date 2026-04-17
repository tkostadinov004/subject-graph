const appState = {
  svg: null,
  zoom: null,
  width: 0,
  height: 0,
  nodes: [],
  simulation: null, // Запазваме симулацията за resize
};

const modalOverlay = document.getElementById("modalOverlay");
const modalCloseBtn = document.getElementById("modalCloseBtn");

modalCloseBtn.addEventListener("click", () => {
  modalOverlay.style.display = "none";
});

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    modalOverlay.style.display = "none";
  }
});

// Зареждане на данните
d3.csv("./data.csv?v=" + new Date().getTime())
  .then(function (data) {
    document.getElementById("loadingMsg").style.display = "none";
    processData(data);
    document.getElementById("searchInput").disabled = false;
    document.getElementById("searchBtn").disabled = false;
  })
  .catch(function (error) {
    console.error("Грешка при зареждане:", error);
    document.getElementById("loadingMsg").innerText =
      "Грешка: Файлът data.csv не може да бъде зареден.";
  });

function processData(data) {
  const nodesMap = new Map();
  const links = [];
  const subjectListDatalist = document.getElementById("subject-list");
  subjectListDatalist.innerHTML = "";

  data.forEach((row) => {
    const category = row.Category?.trim();
    const subject = row.Subject?.trim();
    const role = row.Role?.trim();

    if (!category || !subject) return;

    if (!nodesMap.has(subject)) {
      nodesMap.set(subject, { id: subject, type: "subject", roles: [] });
      const option = document.createElement("option");
      option.value = subject;
      subjectListDatalist.appendChild(option);
    }

    if (!nodesMap.has(category)) {
      nodesMap.set(category, { id: category, type: "category" });
    }

    if (role) {
      nodesMap.get(subject).roles.push(`<b>${category}:</b> ${role}`);
    }

    const linkExists = links.some(
      (l) => l.source === subject && l.target === category,
    );
    if (!linkExists) {
      links.push({ source: subject, target: category });
    }
  });

  const nodes = Array.from(nodesMap.values());
  drawGraph(nodes, links);
}

function drawGraph(nodes, links) {
  const svg = d3.select("#network");
  svg.selectAll("*").remove();

  const container = document.getElementById("graph-container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  const tooltip = d3.select("#tooltip");

  const color = (type) => (type === "subject" ? "#e74c3c" : "#3498db");
  const radius = (type) => (type === "subject" ? 25 : 20);

  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      gCanvas.attr("transform", event.transform);
    });

  svg.call(zoom);

  const gCanvas = svg.append("g");

  appState.svg = svg;
  appState.zoom = zoom;
  appState.width = width;
  appState.height = height;
  appState.nodes = nodes;

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(250),
    )
    .force("charge", d3.forceManyBody().strength(-800))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collide",
      d3.forceCollide().radius((d) => radius(d.type) + 50),
    );

  appState.simulation = simulation; // Запазваме референция за resize

  const link = gCanvas
    .append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .join("line");

  const node = gCanvas
    .append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation));

  node
    .append("circle")
    .attr("r", (d) => radius(d.type))
    .attr("fill", (d) => color(d.type))
    // Тултипът работи най-вече при десктоп
    .on("mouseover", function (event, d) {
      // Проверка за сензорен екран (за да не се показва тултип при тъч)
      if (window.matchMedia("(hover: none)").matches) return;

      if (d.type === "subject" && d.roles.length > 0) {
        tooltip.transition().duration(200).style("opacity", 1);

        let rolesHtml = d.roles.map((r) => `<li>${r}</li>`).join("");
        tooltip.html(
          `<strong>Приложение на ${d.id}:</strong><br><ul>${rolesHtml}</ul>`,
        );

        const [x, y] = d3.pointer(event, container);
        let tooltipX = x + 15;
        let tooltipY = y - 10;
        if (tooltipX + 300 > container.clientWidth) tooltipX = x - 320;

        tooltip.style("left", tooltipX + "px").style("top", tooltipY + "px");
      }
      d3.select(this).style("stroke", "#2c3e50").style("stroke-width", "3px");
    })
    .on("mousemove", function (event, d) {
      if (window.matchMedia("(hover: none)").matches) return;
      if (d.type === "subject") {
        const [x, y] = d3.pointer(event, container);
        let tooltipX = x + 15;
        let tooltipY = y - 10;
        if (tooltipX + 300 > container.clientWidth) tooltipX = x - 320;

        tooltip.style("left", tooltipX + "px").style("top", tooltipY + "px");
      }
    })
    .on("mouseout", function (event, d) {
      tooltip.transition().duration(500).style("opacity", 0);
      d3.select(this).style("stroke", "#fff").style("stroke-width", "2px");
    })
    // Извикване на модалния прозорец при Клик / Touch
    .on("click", function (event, d) {
      if (event.defaultPrevented) return;

      if (d.type === "subject" && d.roles.length > 0) {
        tooltip.style("opacity", 0);

        document.getElementById("modalTitle").innerHTML =
          `Приложение на: <span style="color:#e74c3c">${d.id}</span>`;

        let rolesHtml = d.roles.map((r) => `<li>${r}</li>`).join("");
        document.getElementById("modalContent").innerHTML =
          `<ul>${rolesHtml}</ul>`;

        modalOverlay.style.display = "flex";
      }
    })
    // Специално за по-добро докосване при мобилни (визуална реакция)
    .on(
      "touchstart",
      function () {
        d3.select(this).style("stroke", "#2c3e50").style("stroke-width", "4px");
      },
      { passive: true },
    )
    .on(
      "touchend",
      function () {
        d3.select(this).style("stroke", "#fff").style("stroke-width", "2px");
      },
      { passive: true },
    );

  node
    .append("text")
    .attr("class", "node-label")
    .attr("dy", 4)
    .attr("dx", (d) => radius(d.type) + 5)
    .text((d) => d.id);

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

// --- ДОБАВЕНО: ПРЕОРАЗМЕРЯВАНЕ (RESIZE LISTENER) ---
// Когато екранът (или телефонът) се завърти/промени размер, центрираме пак
window.addEventListener("resize", () => {
  if (!appState.simulation) return;
  const container = document.getElementById("graph-container");
  const newWidth = container.clientWidth;
  const newHeight = container.clientHeight;

  appState.width = newWidth;
  appState.height = newHeight;

  appState.simulation.force(
    "center",
    d3.forceCenter(newWidth / 2, newHeight / 2),
  );
  appState.simulation.alpha(0.3).restart(); // Събуждаме симулацията, за да се намести
});

// --- ЛОГИКА ЗА ТЪРСЕНЕТО ---
document.getElementById("searchBtn").addEventListener("click", performSearch);
document
  .getElementById("searchInput")
  .addEventListener("keypress", function (e) {
    if (e.key === "Enter") performSearch();
  });

function performSearch() {
  if (!appState.nodes.length) return;

  const searchTerm = document
    .getElementById("searchInput")
    .value.trim()
    .toLowerCase();
  if (!searchTerm) return;

  const targetNode = appState.nodes.find(
    (n) => n.type === "subject" && n.id.toLowerCase() === searchTerm,
  );

  if (targetNode) {
    // На мобилно приближаваме малко по-слабо, за да не се губи контекстът
    const isMobile = window.innerWidth <= 600;
    const scale = isMobile ? 1.5 : 2.5;

    appState.svg
      .transition()
      .duration(1000)
      .call(
        appState.zoom.transform,
        d3.zoomIdentity
          .translate(appState.width / 2, appState.height / 2)
          .scale(scale)
          .translate(-targetNode.x, -targetNode.y),
      );

    d3.selectAll(".nodes circle")
      .style("stroke", (d) => (d.id === targetNode.id ? "#f1c40f" : "#fff"))
      .style("stroke-width", (d) => (d.id === targetNode.id ? "5px" : "2px"));

    setTimeout(() => {
      d3.selectAll(".nodes circle")
        .style("stroke", "#fff")
        .style("stroke-width", "2px");
    }, 3000);
  } else {
    alert("Предметът не е намерен! Проверете името и опитайте отново.");
  }
}
