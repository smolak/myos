export interface TemplateVars {
  readonly date: string;
  readonly time: string;
  readonly datetime: string;
  readonly clipboard: string;
}

export function buildVars(now: Date, clipboard = ""): TemplateVars {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const datetime = `${date} ${time}`;
  return { date, time, datetime, clipboard };
}

export function expandTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{time\}\}/g, vars.time)
    .replace(/\{\{datetime\}\}/g, vars.datetime)
    .replace(/\{\{clipboard\}\}/g, vars.clipboard);
}
